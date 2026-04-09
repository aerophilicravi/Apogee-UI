# 🚁 Apogee (MAVLink .bin to EXIF)

A zero-configuration Python script that automatically synchronizes and embeds highly accurate GPS coordinates from a drone's flight log (`.bin`) directly into the EXIF metadata of your aerial photographs (`.jpg`). 

Perfect for drone mappers, surveyors, and hobbyists using standalone cameras (like GoPros, Sony Alpha, etc.) alongside ArduPilot/PX4 flight controllers.

## ✨ Features
* **Zero-Configuration Paths:** Just drop the script into the folder with your images and log file. It auto-detects everything.
* **Auto-Dependency Installer:** No need to mess with `pip`. The script automatically checks for and installs required packages (`piexif`, `pymavlink`) if they are missing.
* **Smart Time Synchronization:** Automatically calculates the time drift between your camera's internal clock and the drone's GPS clock.
* **Precise Interpolation:** Calculates the exact microsecond location of the drone between GPS pings for pinpoint accuracy.
* **Google Earth Export with Thumbnails:** Automatically generates a `geotags.kmz` file with embedded image thumbnails. When you click a pin in Google Earth, you can instantly see a preview of the photo for faster Quality Control (QC).
* **Custom Logo Support:** Place your company logo (e.g., `indrones_logo.png`) in the same folder, and it will automatically be embedded and displayed in the top-left corner of Google Earth.

## 🧠 How It Works (The Logic)
Standalone cameras rarely have their clocks perfectly synced to the millisecond with a drone's GPS. This script solves that by using a smart altitude threshold:
1. It scans the `.bin` log for the **first camera trigger (`CAM` message) that occurred in the air** (default: >40 meters above the takeoff altitude).
2. It looks at your images and finds the **first photo** based on its timestamp.
3. It assumes this first photo corresponds to the first aerial trigger, calculates the exact time difference (offset), and applies this correction to *all* subsequent photos.

> ⚠️ **CRITICAL REQUIREMENT:** Because of this logic, **you MUST delete any test photos taken on the ground** before running the script. The chronologically first `.jpg` in the folder *must* be the first photo taken in the air.

## 🚀 Usage Instructions

### Prerequisites
* You must have [Python 3.x](https://www.python.org/downloads/) installed on your computer.

### Step-by-Step Guide
1. Create a new folder on your computer.
2. Place your drone's flight log (`.bin` file) into this folder.
3. Place all your aerial photos (`.jpg` or `.JPG`) into this folder.
4. **Delete any test photos taken on the ground.**
5. Download `geotag.py` (this script) and place it into the exact same folder.
6. Open your terminal or command prompt, navigate to the folder, and run:

```bash
python geotag.py
```

That's it! The script will install its own dependencies, find the files, calculate the time offset, and generate a `geotags.kmz` map. 

You can then open the KMZ file in Google Earth to verify the locations are correct. The script will pause and ask:
`Do you want to proceed and write the GPS data into the image EXIF?`

If you are happy with the locations, type `y` to start the time-consuming process of injecting the GPS data into the images.

## ⚙️ Advanced Usage (Command Line Arguments)

By default, the script considers the drone "in the air" when it is 40 meters above the ground. If you flew a low-altitude mission (e.g., 25 meters), you can change this threshold using the `--alt` flag:

```bash
python geotag.py --alt 20.0
```

## 📦 Output
After the script finishes running, you will have:
1. **Modified `.jpg` files:** Your original images will now contain standard GPS EXIF tags (Latitude, Longitude, Altitude). They are now ready to be imported into photogrammetry software like WebODM, Agisoft Metashape, or Pix4D.
2. **`geotags.kmz`:** A Google Earth compatible file showing a 3D pin for exactly where every photo was taken.

## 🛠️ Troubleshooting

| Issue | Cause / Solution |
| :--- | :--- |
| **"Error: No .bin file found"** | Ensure the `.bin` file is in the exact same folder as the `geotag.py` script. |
| **"Could not find a CAM tag above altitude threshold"** | The drone never reached 40m, or the camera wasn't triggered. Try running with a lower threshold: `python geotag.py --alt 10.0` |
| **Photos are tagged in the wrong location** | You likely forgot to delete ground test photos. The first photo in the folder *must* match the first time the drone triggered the camera in the air. |
| **"Error installing piexif/pymavlink"** | Your Python environment might be restricted. Try opening your terminal as Administrator, or manually run `pip install piexif pymavlink`. |

## 📄 License
This project is open-source and available under the MIT License. Feel free to fork, modify, and use it in your own mapping pipelines!
