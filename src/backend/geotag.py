import os
import glob
import argparse
import zipfile
import io
from datetime import datetime, timedelta
from fractions import Fraction
import sys
import subprocess
import concurrent.futures
import multiprocessing
import time
import json
import base64
import re
import shutil

# --- AUTO-INSTALLER FOR REQUIRED PACKAGES ---
def install_package(package_name):
    print(f"Package '{package_name}' is missing. Installing the latest version...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", package_name])
        print(f"Successfully installed '{package_name}'.\n")
    except subprocess.CalledProcessError as e:
        print(f"Error installing '{package_name}'. Please install it manually using: pip install {package_name}")
        sys.exit(1)

# Check and import piexif
try:
    import piexif
except ImportError:
    install_package("piexif")
    import piexif

# Check and import pymavlink
try:
    from pymavlink import mavutil
except ImportError:
    install_package("pymavlink")
    from pymavlink import mavutil

# Check and import PIL (Pillow) for thumbnails
try:
    from PIL import Image
except ImportError:
    install_package("Pillow")
    from PIL import Image

def get_logo_path():
    """Locate the logo.png asset in dev or production (PyInstaller frozen) environments."""
    # PyInstaller frozen: _MEIPASS is the temp extraction directory
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        meipass_logo = os.path.join(sys._MEIPASS, 'logo.png')
        if os.path.exists(meipass_logo):
            return meipass_logo
    # Development: walk relative to this script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    potential_paths = [
        os.path.join(script_dir, "..", "..", "public", "logo.png"),
        os.path.join(script_dir, "..", "..", "..", "logo.png"),
        os.path.join(script_dir, "logo.png"),
        os.path.join(os.path.dirname(script_dir), "logo.png"),
        "logo.png"
    ]
    for p in potential_paths:
        if os.path.exists(p):
            return p
    return None

def get_exif_time(image_path):
    try:
        exif_dict = piexif.load(image_path)
        if "Exif" in exif_dict and piexif.ExifIFD.DateTimeOriginal in exif_dict["Exif"]:
            dt_str = exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal].decode("utf-8")
            return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
    except Exception as e:
        print(f"Error reading EXIF from {image_path}: {e}")
    return None

def change_to_rational(number):
    f = Fraction(str(number)).limit_denominator(1000000)
    return (f.numerator, f.denominator)

def set_gps_exif(image_path, lat, lng, alt):
    try:
        exif_dict = piexif.load(image_path)
        lat_deg = abs(lat)
        lat_min = (lat_deg - int(lat_deg)) * 60
        lat_sec = (lat_min - int(lat_min)) * 60
        lng_deg = abs(lng)
        lng_min = (lng_deg - int(lng_deg)) * 60
        lng_sec = (lng_min - int(lng_min)) * 60
        exif_lat = (change_to_rational(int(lat_deg)), change_to_rational(int(lat_min)), change_to_rational(round(lat_sec, 5)))
        exif_lng = (change_to_rational(int(lng_deg)), change_to_rational(int(lng_min)), change_to_rational(round(lng_sec, 5)))
        lat_ref = "N" if lat >= 0 else "S"
        lng_ref = "E" if lng >= 0 else "W"
        gps_ifd = {
            piexif.GPSIFD.GPSVersionID: (2, 0, 0, 0),
            piexif.GPSIFD.GPSAltitudeRef: 1 if alt < 0 else 0,
            piexif.GPSIFD.GPSAltitude: change_to_rational(round(abs(alt), 2)),
            piexif.GPSIFD.GPSLatitudeRef: lat_ref.encode('utf-8'),
            piexif.GPSIFD.GPSLatitude: exif_lat,
            piexif.GPSIFD.GPSLongitudeRef: lng_ref.encode('utf-8'),
            piexif.GPSIFD.GPSLongitude: exif_lng,
        }
        exif_dict["GPS"] = gps_ifd
        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, image_path)
        return True
    except Exception as e:
        print(f"Error writing EXIF to {image_path}: {e}")
        return False

def get_gps_time(gwk, gms):
    gps_epoch = datetime(1980, 1, 6)
    return gps_epoch + timedelta(weeks=gwk, milliseconds=gms)

def get_field(msg, field_names):
    for name in field_names:
        if hasattr(msg, name):
            return getattr(msg, name)
    return None

def parse_bin_log(bin_file):
    mlog = mavutil.mavlink_connection(bin_file)
    gps_data = []
    cam_data = []
    print(f"Parsing {os.path.basename(bin_file)}...")
    while True:
        msg = mlog.recv_match(type=['GPS', 'CAM'], blocking=False)
        if msg is None:
            break
        msg_type = msg.get_type()
        if msg_type == 'GPS':
            status = get_field(msg, ['Status', 'FixType'])
            if status is not None and status >= 3:
                gwk = get_field(msg, ['GWk', 'Week', 'GPSWeek'])
                gms = get_field(msg, ['GMS', 'TimeMS', 'GPSTime'])
                time_us = get_field(msg, ['TimeUS'])
                lat = get_field(msg, ['Lat'])
                lng = get_field(msg, ['Lng'])
                alt = get_field(msg, ['Alt'])
                if gwk is not None and gms is not None:
                    dt = get_gps_time(gwk, gms)
                    gps_data.append({'TimeUS': time_us, 'time': dt, 'lat': lat, 'lng': lng, 'alt': alt})
        elif msg_type == 'CAM':
            gwk = get_field(msg, ['GWk', 'Week', 'GPSWeek'])
            gms = get_field(msg, ['GMS', 'TimeMS', 'GPSTime'])
            time_us = get_field(msg, ['TimeUS'])
            lat = get_field(msg, ['Lat'])
            lng = get_field(msg, ['Lng'])
            alt = get_field(msg, ['Alt'])
            dt = None
            if gwk is not None and gms is not None:
                dt = get_gps_time(gwk, gms)
            cam_data.append({'TimeUS': time_us, 'time': dt, 'lat': lat, 'lng': lng, 'alt': alt})
    return gps_data, cam_data

def interpolate_gps(gps_data, target_time):
    if not gps_data:
        return None
    sorted_gps = sorted(gps_data, key=lambda x: x['time'])
    if target_time <= sorted_gps[0]['time']:
        return {'lat': sorted_gps[0]['lat'], 'lng': sorted_gps[0]['lng'], 'alt': sorted_gps[0]['alt']}
    if target_time >= sorted_gps[-1]['time']:
        return sorted_gps[-1]
    for i in range(len(sorted_gps) - 1):
        if sorted_gps[i]['time'] <= target_time <= sorted_gps[i+1]['time']:
            before = sorted_gps[i]
            after = sorted_gps[i+1]
            dt_total = (after['time'] - before['time']).total_seconds()
            if dt_total == 0:
                return before
            ratio = (target_time - before['time']).total_seconds() / dt_total
            return {
                'lat': before['lat'] + (after['lat'] - before['lat']) * ratio,
                'lng': before['lng'] + (after['lng'] - before['lng']) * ratio,
                'alt': before['alt'] + (after['alt'] - before['alt']) * ratio
            }
    return None

def generate_thumbnail_worker(img_data):
    try:
        path = img_data['path']
        img = Image.open(path)
        img.thumbnail((400, 300))
        logo_path = get_logo_path()
        if logo_path:
            logo = Image.open(logo_path).convert("RGBA")
            logo.thumbnail((100, 50))
            img = img.convert("RGBA")
            # Set logo margin (15px from right, 10px from top)
            img.alpha_composite(logo, (img.width - logo.width - 15, 10))
            img = img.convert("RGB")
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=85)
        thumb_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        img_data['thumbnail'] = f"data:image/jpeg;base64,{thumb_base64}"
        return img_data
    except Exception as e:
        print(f"Error generating thumbnail for {os.path.basename(img_data['path'])}: {e}")
        return img_data

def set_gps_exif_worker(img_data):
    success = set_gps_exif(img_data['path'], img_data['lat'], img_data['lng'], img_data['alt'])
    return img_data['path'], success

def create_kml(tagged_images, cam_data, output_path, image_dir, multiprocess=False):
    # Extract a clean mission name from the folder (last 4 chars)
    folder_name = os.path.basename(os.path.normpath(image_dir))
    mission_id = folder_name[-4:] if len(folder_name) >= 4 else folder_name
    kml_name = f"Indrones - {mission_id}"
    
    kml_header = f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{kml_name}</name>
    <Style id="triggerStyle">
      <IconStyle>
        <scale>0.5</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0</scale>
      </LabelStyle>
    </Style>
    <!-- [METADATA] photos:{len(tagged_images)}, triggers:{len(cam_data)} -->
    <ScreenOverlay>
      <name>Indrones Logo</name>
      <Icon>
        <href>logo.png</href>
      </Icon>
      <overlayXY x="0" y="1" xunits="fraction" yunits="fraction"/>
      <screenXY x="0.02" y="0.98" xunits="fraction" yunits="fraction"/>
      <rotationXY x="0" y="0" xunits="fraction" yunits="fraction"/>
      <size x="180" y="0" xunits="pixels" yunits="pixels"/>
    </ScreenOverlay>'''
    kml_footer = '''  </Document>
</kml>'''
    placemarks = []
    print("\nGenerating branded thumbnails and KML data...")
    if multiprocess:
        workers = min(multiprocessing.cpu_count() or 2, 8)
        with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as executor:
            tagged_images_data = list(executor.map(generate_thumbnail_worker, tagged_images))
    else:
        tagged_images_data = [generate_thumbnail_worker(img) for img in tagged_images]
    for img in tagged_images_data:
        pm = f'''    <Placemark>
      <name>{os.path.basename(img['path'])}</name>
      <description><![CDATA[
        <div style="font-family:sans-serif; min-width:250px;">
          <img src="{img.get('thumbnail', '')}" style="width:100%; border-radius:4px; margin-bottom:10px; border:1px solid #e2e8f0;" />
          <div style="background:#f8fafc; padding:8px; border-radius:4px; border:1px solid #f1f5f9;">
            <p style="margin:0; font-size:11px; color:#64748b;"><b>Filename:</b> {os.path.basename(img['path'])}</p>
            <p style="margin:4px 0; font-size:11px; color:#64748b;"><b>Coordinates:</b> {img['lat']:.6f}, {img['lng']:.6f}</p>
            <p style="margin:0; font-size:11px; color:#64748b;"><b>MSL Altitude:</b> <span style="color:#c026d3; font-weight:bold;">{img['alt']:.2f}m</span></p>
          </div>
        </div>
      ]]></description>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>{img['lng']},{img['lat']},{img['alt']}</coordinates>
      </Point>
    </Placemark>'''
        placemarks.append(pm)
    
    image_folder = "    <Folder>\n      <name>Geotagged Photos</name>\n"
    image_folder += "\n".join(placemarks)
    image_folder += "\n    </Folder>"
    
    trigger_folder = "    <Folder>\n      <name>Log Triggers</name>\n"
    for i, cam in enumerate(cam_data):
        trigger_folder += f'''      <Placemark>
        <name>Trigger {i+1}</name>
        <styleUrl>#triggerStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode>
          <coordinates>{cam['lng']},{cam['lat']},{cam['alt']}</coordinates>
        </Point>
      </Placemark>\n'''
    trigger_folder += "    </Folder>"
    
    kml_content = kml_header + "\n" + image_folder + "\n" + trigger_folder + "\n" + kml_footer
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(kml_content)
    return kml_content

def finalize_kml_assets(image_dir):
    logo_path = get_logo_path()
    if logo_path:
        try:
            shutil.copy2(logo_path, os.path.join(image_dir, 'logo.png'))
        except:
            pass

def main():
    parser = argparse.ArgumentParser(description="Indrones GeoTag Solution")
    parser.add_argument("--image-dir", help="Path to folder containing drone images")
    parser.add_argument("--alt-threshold", type=float, default=40.0, help="Min MSL altitude to consider drone airborne")
    parser.add_argument("--auto-write", action="store_true", help="Auto-inject EXIF after calculation")
    parser.add_argument("--exif-only", action="store_true", help="Run without KML generation (internal use)")
    parser.add_argument("--mp", action="store_true", help="Use multiprocessing for performance")
    args = parser.parse_args()
    if not args.image_dir or not os.path.isdir(args.image_dir):
        print(f"Error: Invalid or missing image directory: {args.image_dir}")
        return
    image_dir = os.path.abspath(args.image_dir)
    alt_threshold = args.alt_threshold
    auto_write = args.auto_write
    multiprocess = args.mp
    bin_files = glob.glob(os.path.join(image_dir, "*.bin"))
    if not bin_files:
        print(f"Error: No .bin flight log found in {image_dir}")
        return
    bin_file = bin_files[0]
    gps_data, cam_data = parse_bin_log(bin_file)
    if not cam_data:
        print("Error: No CAM messages found in log.")
        return
    search_pattern = os.path.join(image_dir, "*.[jJ][pP][gG]")
    image_files = glob.glob(search_pattern)
    images = []
    for img in image_files:
        dt = get_exif_time(img)
        if dt:
            images.append({'path': img, 'time': dt})
    if not images:
        print(f"Error: No images with EXIF time found.")
        return
    images.sort(key=lambda x: x['time'])
    print(f"Found {len(gps_data)} GPS points, {len(cam_data)} CAM triggers, and {len(images)} images.")
    print(f"[METADATA] photos:{len(images)}, triggers:{len(cam_data)}")
    ground_alt = gps_data[0]['alt'] if gps_data else 0
    first_air_cam = None
    for cam in cam_data:
        if (cam['alt'] - ground_alt) > alt_threshold:
            first_air_cam = cam
            break
    if not first_air_cam:
        print(f"Error: Could not find CAM tag above MSL threshold ({alt_threshold}m).")
        return
    print(f"First air CAM tag: {first_air_cam['time']} (MSL Alt: {first_air_cam['alt']:.2f}m)")
    first_image = images[0]
    time_offset = first_air_cam['time'] - first_image['time']
    tagged_images_data = []
    for img in images:
        corrected_time = img['time'] + time_offset
        gps = interpolate_gps(gps_data, corrected_time)
        if gps:
            tagged_images_data.append({'path': img['path'], 'lat': gps['lat'], 'lng': gps['lng'], 'alt': gps['alt']})
            print(f"Synced {os.path.basename(img['path'])} -> MSL Alt: {gps['alt']:.2f}m")
    if tagged_images_data:
        kml_path = os.path.join(image_dir, "geotags.kml")
        create_kml(tagged_images_data, cam_data, kml_path, image_dir, multiprocess)
        finalize_kml_assets(image_dir)
        if auto_write or args.exif_only:
            print("\nStarting EXIF Injector...")
            workers = min(multiprocessing.cpu_count() or 2, 8) if multiprocess else 1
            with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as executor:
                results = executor.map(set_gps_exif_worker, tagged_images_data)
                for path, scs in results:
                    if scs: print(f"Geotagged {os.path.basename(path)}")

if __name__ == "__main__":
    # Required by PyInstaller when using multiprocessing in --onefile mode.
    # Without this, spawned worker processes re-execute the entire script.
    multiprocessing.freeze_support()
    main()
