import os
import zipfile
import glob
import json

# meta-information for the build process (list the required files for the output zip fiile + grab the extension's version from the manifest file)
required_files = ["*.js", "*.css", "*.html", "*.png", "*.ttf", "manifest.json"]
if not os.path.exists("manifest.json"):
    print("manifest.json doesn't exist! Exiting with failure...")
    sys.exit(1)
with open("manifest.json", "r") as manifest_file:
    manifest_data = json.loads(manifest_file.read())
    extension_version = manifest_data["version"]

# loop through the filename patterns in required_files and add them to a list of all the files we need to add
zipped_filenames = []
for pattern in required_files:
    zipped_filenames += glob.glob(pattern)

# zip all the files
print("Zipping the following files:\n")
zip_file = zipfile.ZipFile("Playlist_release_v{}.zip".format(extension_version), "w", zipfile.ZIP_DEFLATED) # create zip file
for filename in zipped_filenames:
    zip_file.write(filename)
    print(filename)
print("\nTotal: {} files".format(len(zipped_filenames)))
