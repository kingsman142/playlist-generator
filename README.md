# playlist-generator
[![licensebuttons by-nc](https://licensebuttons.net/l/by-nc/3.0/88x31.png)](https://creativecommons.org/licenses/by-nc/4.0)

I gained inspiration for this project from a problem of mine: too many Youtube bookmarks of my favorite songs were on my computer, yet there was no way to play them all efficiently; so, my solution was to make my own playlist to enjoy hundreds of hours of music (turns out I had ~1877 bookmarks, wow). This program utilizes JavaScript and HTML forms to create a chrome extension, accessing a user's bookmarks on the current computer. These bookmarks are then stored, a 465x475 chrome window is opened, and the songs begin to be looped; it's as easy as that. Future features may include access to the Spotify API in order to sync a user's Spotify songs and their Youtube bookmarks.

This project is open source, so feel free to contribute.

Chrome Web Store Link (Playlist Generator) - https://chrome.google.com/webstore/detail/playlist-generator/gcnopleiakgahapanbdcegkccdifbbae

TODO (important)
* Create a bash or python script to zip all the necessary files up in the correct format for easy publishing of the extension on the web store
* Add persistent memory so we can store banned songs/URLs between sessions (long term)
* Fix the scrollbars so they are removed faster

TODO (nice to have)
* Hook up to Spotify API
* Separate out songs by types/genres and mood for the user
* Machine. Learning. ;)
