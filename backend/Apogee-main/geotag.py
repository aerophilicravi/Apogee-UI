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

# --- AUTO-INSTALLER FOR REQUIRED PACKAGES ---
def install_package(package_name):
    print(f"Package '{package_name}' is missing. Installing the latest version...")
    try:
        # Uses the current Python executable to run pip and install/upgrade the package
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
# --------------------------------------------

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
        
        # Latitude math
        lat_deg = abs(lat)
        lat_min = (lat_deg - int(lat_deg)) * 60
        lat_sec = (lat_min - int(lat_min)) * 60
        
        # Longitude math
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
    # GPS epoch is Jan 6, 1980
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
                    gps_data.append({
                        'TimeUS': time_us,
                        'time': dt,
                        'lat': lat,
                        'lng': lng,
                        'alt': alt
                    })
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
                
            cam_data.append({
                'TimeUS': time_us,
                'time': dt,
                'lat': lat,
                'lng': lng,
                'alt': alt
            })
            
    # Interpolate missing data for CAM messages using GPS data
    for cam in cam_data:
        if (cam['time'] is None or cam['alt'] is None) and cam['TimeUS'] is not None and gps_data:
            before = None
            after = None
            for i in range(len(gps_data) - 1):
                if gps_data[i]['TimeUS'] is not None and gps_data[i+1]['TimeUS'] is not None:
                    if gps_data[i]['TimeUS'] <= cam['TimeUS'] <= gps_data[i+1]['TimeUS']:
                        before = gps_data[i]
                        after = gps_data[i+1]
                        break
            if before and after and before['TimeUS'] != after['TimeUS']:
                ratio = (cam['TimeUS'] - before['TimeUS']) / (after['TimeUS'] - before['TimeUS'])
                if cam['time'] is None:
                    dt_total = (after['time'] - before['time']).total_seconds()
                    cam['time'] = before['time'] + timedelta(seconds=dt_total * ratio)
                if cam['alt'] is None:
                    cam['alt'] = before['alt'] + (after['alt'] - before['alt']) * ratio
            elif before:
                if cam['time'] is None: cam['time'] = before['time']
                if cam['alt'] is None: cam['alt'] = before['alt']
                
    # Filter out CAM messages that still don't have a time or alt
    cam_data = [c for c in cam_data if c['time'] is not None and c['alt'] is not None]
            
    return gps_data, cam_data

def interpolate_gps(gps_data, target_time):
    # Find bracketing GPS messages
    before = None
    after = None
    
    for i in range(len(gps_data) - 1):
        if gps_data[i]['time'] <= target_time <= gps_data[i+1]['time']:
            before = gps_data[i]
            after = gps_data[i+1]
            break
            
    if not before or not after:
        return None
        
    dt_total = (after['time'] - before['time']).total_seconds()
    if dt_total == 0:
        return before
        
    dt_target = (target_time - before['time']).total_seconds()
    ratio = dt_target / dt_total
    
    lat = before['lat'] + (after['lat'] - before['lat']) * ratio
    lng = before['lng'] + (after['lng'] - before['lng']) * ratio
    alt = before['alt'] + (after['alt'] - before['alt']) * ratio
    
    return {'lat': lat, 'lng': lng, 'alt': alt}

def generate_thumbnail_worker(img_data):
    try:
        with Image.open(img_data['path']) as pil_img:
            pil_img.thumbnail((400, 400))
            thumb_io = io.BytesIO()
            pil_img.save(thumb_io, format='JPEG')
            return img_data['path'], thumb_io.getvalue(), None
    except Exception as e:
        return img_data['path'], None, str(e)

def set_gps_exif_worker(img_data):
    success = set_gps_exif(img_data['path'], img_data['lat'], img_data['lng'], img_data['alt'])
    return img_data['path'], success

def benchmark_and_get_workers(worker_func, sample_items, task_name):
    if len(sample_items) < 10:
        return False, 1
        
    print(f"\nRunning micro-benchmark for {task_name} to determine optimal processing mode...")
    
    sample_seq = sample_items[0:2]
    sample_par = sample_items[2:4]
    
    # Sequential
    t0 = time.time()
    for item in sample_seq:
        worker_func(item)
    seq_time = time.time() - t0
    
    # Parallel
    t0 = time.time()
    with concurrent.futures.ProcessPoolExecutor(max_workers=2) as executor:
        list(executor.map(worker_func, sample_par))
    par_time = time.time() - t0
    
    print(f"  -> Sequential time (2 items): {seq_time:.2f}s")
    print(f"  -> Parallel time (2 items): {par_time:.2f}s")
    
    if par_time < seq_time * 0.85: # Parallel is at least 15% faster
        workers = min(multiprocessing.cpu_count() or 2, 8)
        print(f"  -> Result: Multiprocessing is faster. Using {workers} workers.")
        return True, workers
    else:
        print("  -> Result: Sequential is faster or similar (likely HDD/SD Card). Using 1 worker.")
        return False, 1

def create_kmz(tagged_images, output_path, image_dir):
    kml_header = '''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Geotagged Images</name>'''
    
    # Check for logo
    logo_kml = ""
    logo_filename = None
    logo_path = None
    
    # Look for indrones logo or any logo png/jpg
    possible_logos = glob.glob(os.path.join(image_dir, "*indrones*.png")) + \
                     glob.glob(os.path.join(image_dir, "*logo*.png")) + \
                     glob.glob(os.path.join(image_dir, "*indrones*.jpg")) + \
                     glob.glob(os.path.join(image_dir, "*logo*.jpg"))
                     
    if possible_logos:
        logo_path = possible_logos[0]
        logo_filename = os.path.basename(logo_path)
        logo_kml = f'''
    <ScreenOverlay>
      <name>Indrones Logo</name>
      <Icon>
        <href>{logo_filename}</href>
      </Icon>
      <overlayXY x="0" y="1" xunits="fraction" yunits="fraction"/>
      <screenXY x="0.02" y="0.98" xunits="fraction" yunits="fraction"/>
      <rotationXY x="0" y="0" xunits="fraction" yunits="fraction"/>
      <size x="0.15" y="0" xunits="fraction" yunits="fraction"/>
    </ScreenOverlay>'''

    kml_footer = '''  </Document>
</kml>'''
    
    placemarks = []
    total_images = len(tagged_images)
    
    try:
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as kmz:
            # Add logo to KMZ if found
            if logo_path and logo_filename:
                kmz.write(logo_path, logo_filename)
                
            use_mp, workers = benchmark_and_get_workers(generate_thumbnail_worker, tagged_images, "Thumbnail Generation")
            
            print(f"\nGenerating thumbnails and creating KMZ ({total_images} images)...")
            
            if use_mp:
                executor = concurrent.futures.ProcessPoolExecutor(max_workers=workers)
                results_iter = executor.map(generate_thumbnail_worker, tagged_images)
            else:
                results_iter = map(generate_thumbnail_worker, tagged_images)
                
            for i, (img, (path, thumb_bytes, err)) in enumerate(zip(tagged_images, results_iter)):
                filename = os.path.basename(img['path'])
                lat = img['lat']
                lng = img['lng']
                alt = img['alt']
                
                # Print progress without a newline so "Done" or "Failed" can be appended
                print(f"[{i+1}/{total_images}] Processing {filename}... ", end="", flush=True)
                
                if err:
                    print(f"Failed! Error: {err}")
                else:
                    kmz.writestr(f'thumbnails/{filename}', thumb_bytes)
                    print("Done.")
                
                placemark = f'''
    <Placemark>
      <name>{filename}</name>
      <description><![CDATA[<img src="thumbnails/{filename}" width="400" />]]></description>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>{lng},{lat},{alt}</coordinates>
      </Point>
    </Placemark>'''
                placemarks.append(placemark)
                
            if use_mp:
                executor.shutdown()
                
            print("\nFinalizing KMZ archive... ", end="", flush=True)
            kml_content = kml_header + logo_kml + "".join(placemarks) + kml_footer
            kmz.writestr('doc.kml', kml_content)
            print("Done.")
            
        print(f"\nSuccessfully created KMZ file with thumbnails: {output_path}")
    except PermissionError:
        print(f"\nCritical Error: Permission denied when trying to write to {output_path}.")
        print("Is the file currently open in another program (like Google Earth)? Please close it and try again.")
    except Exception as e:
        print(f"\nCritical Error creating KMZ: {e}")

def main(bin_file, image_dir, alt_threshold=40.0):
    gps_data, cam_data = parse_bin_log(bin_file)
    
    if not gps_data:
        print("Error: No valid GPS data found in log.")
        return
        
    if not cam_data:
        print("Error: No CAM messages found in log. Cannot auto-detect first air tag.")
        return
        
    # Read images
    search_pattern = os.path.join(image_dir, "*.[jJ][pP][gG]")
    image_files = glob.glob(search_pattern)
    images = []
    
    for img in image_files:
        dt = get_exif_time(img)
        if dt:
            images.append({'path': img, 'time': dt})
            
    if not images:
        print(f"Error: No images with EXIF time found in {image_dir}.")
        return
        
    images.sort(key=lambda x: x['time'])
    
    print(f"Found {len(gps_data)} GPS points, {len(cam_data)} CAM triggers, and {len(images)} images.")
    
    # Find first CAM tag in the air
    ground_alt = gps_data[0]['alt']
    first_air_cam = None
    
    for cam in cam_data:
        if (cam['alt'] - ground_alt) > alt_threshold:
            first_air_cam = cam
            break
            
    if not first_air_cam:
        print(f"Error: Could not find a CAM tag above the altitude threshold ({alt_threshold}m).")
        return
        
    print(f"First air CAM tag found at {first_air_cam['time']} (Alt: {first_air_cam['alt']:.2f}m)")
    
    first_image = images[0]
    print(f"First image time: {first_image['time']} (File: {os.path.basename(first_image['path'])})")
    
    # Calculate offset
    time_offset = first_air_cam['time'] - first_image['time']
    print(f"Calculated time offset: {time_offset.total_seconds():.2f} seconds")
    
    # Calculate locations
    tagged_images_data = []
    print("\nCalculating GPS coordinates for images...")
    
    for img in images:
        corrected_time = img['time'] + time_offset
        gps = interpolate_gps(gps_data, corrected_time)
        
        if gps:
            tagged_images_data.append({
                'path': img['path'],
                'lat': gps['lat'],
                'lng': gps['lng'],
                'alt': gps['alt']
            })
            print(f"Calculated {os.path.basename(img['path'])} -> Lat: {gps['lat']:.6f}, Lng: {gps['lng']:.6f}")
        else:
            print(f"Warning: Could not interpolate GPS for {os.path.basename(img['path'])} at {corrected_time}")
            
    print(f"\nCalculated locations for {len(tagged_images_data)} out of {len(images)} images.")
    
    if tagged_images_data:
        kmz_path = os.path.join(image_dir, "geotags.kmz")
        create_kmz(tagged_images_data, kmz_path, image_dir)
        
        print(f"\nPlease review the generated KMZ file: {kmz_path}")
        
        # Prompt user for confirmation
        while True:
            user_input = input("Do you want to proceed and write the GPS data into the image EXIF? This may take some time. (y/n): ").strip().lower()
            if user_input in ['y', 'yes']:
                write_exif = True
                break
            elif user_input in ['n', 'no']:
                write_exif = False
                break
            else:
                print("Please enter 'y' or 'n'.")
                
        if write_exif:
            print("\nStarting EXIF geotagging process...")
            
            use_mp, workers = benchmark_and_get_workers(set_gps_exif_worker, tagged_images_data, "EXIF Tagging")
            
            tagged_count = 0
            
            if use_mp:
                with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as executor:
                    results = executor.map(set_gps_exif_worker, tagged_images_data)
                    for path, success in results:
                        if success:
                            tagged_count += 1
                            print(f"Tagged {os.path.basename(path)}")
            else:
                for img_data in tagged_images_data:
                    path, success = set_gps_exif_worker(img_data)
                    if success:
                        tagged_count += 1
                        print(f"Tagged {os.path.basename(path)}")
                        
            print(f"\nDone! Successfully tagged {tagged_count} out of {len(tagged_images_data)} images.")
        else:
            print("\nSkipping EXIF writing. Original images remain unmodified.")
    else:
        print("\nNo images were successfully matched with GPS data.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Geotag drone images using a .bin log file in the same folder.')
    parser.add_argument('--alt', type=float, default=40.0, help='Altitude threshold (meters) to consider the drone "in the air"')
    
    args = parser.parse_args()
    
    # Automatically get the directory where this script is currently located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Search for a .bin file in the same directory
    bin_files = glob.glob(os.path.join(script_dir, "*.bin"))
    
    if not bin_files:
        print(f"Error: No .bin file found in {script_dir}")
        print("Please place this script in the same folder as your .bin file and .jpg images.")
        exit(1)
        
    if len(bin_files) > 1:
        print(f"Warning: Multiple .bin files found. Using the first one: {os.path.basename(bin_files[0])}")
        
    bin_file = bin_files[0]
    
    print(f"Processing directory: {script_dir}")
    print(f"Using log file: {os.path.basename(bin_file)}")
    
    # Run the main function using the auto-detected paths
    main(bin_file, script_dir, args.alt)
