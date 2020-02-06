/*
James Hahn, 2016

I gained inspiration for this project from a problem of mine that I recognized:
I had too many Youtube bookmarks of my favorite songs, yet no way to play them all efficiently;
so, my solution was to make my own playlist so I can enjoy literally hundreds of hours of music (turns out I had ~1860 bookmarks, wow).
This program utilizes JavaScript to create a chrome extension, accessing a user's
bookmarks on the current computer. These bookmarks are then stored, and the Google Chrome API
is used to execute scripts on a new chrome tab, which loops through the bookmarks.
*/

var bookmarkIds = [];
var folderNamesList = [];
var backgroundPage = chrome.extension.getBackgroundPage()

// main function to run the program
function getBookmarks(){
    chrome.bookmarks.getTree(function(bookmarks){ // iterate over the bookmarks on the bookmarks bar
        var folderNamesString = window.document.getElementById("foldersForm").value;
        parseFolders(folderNamesString);

        for(var j = 0; j < folderNamesList.length; j++){
            bookmarks.forEach(function(folder){
                searchForBookmarks(folder, folderNamesList[j]); // collect all bookmarks in the "Music" folder and put them into the bookmarkIds array
            })
        }

        backgroundPage.console.log("===== Total # of bookmarks: " + bookmarkIds.length + " =====");

        var bgPage = backgroundPage;
        bgPage.startPlaylist(bookmarkIds);
    });
}

// traverses entire list of bookmarks to find all the folders containing music (specified by user) and then adds every Youtube bookmark to the bookmarkIds array
function searchForBookmarks(folder, title){
    folder.children.forEach(function(child){ // loop through all bookmarks
        if(child.title == title){ // if the item title matches the title of the folder we're looking for ("Music"), proceed
            collectBookmarks(child); // loop through all the bookmarks in the folder that we found
        } else if(child.children){ // if the item is a folder, it has children
            searchForBookmarks(child, title);
        }
    })
}
function collectBookmarks(folder){
    folder.children.forEach(function(child){
        if(child.url){
          if(findWord("youtube.com", child.url)){
              var videoID = findVideoID(child.url); // find the video ID of the video and add it to the bookmarks ID array
              if(videoID != null) bookmarkIds.push(videoID); // find the video ID of the video and add it to the bookmarks ID array
          }
        } else{ // it's a folder
            collectBookmarks(child)
        }
    })

    backgroundPage.console.log("=== Folder: " + folder.id + " contains " + folder.children.length + " songs ===");
}

// takes a Youtube url and returns the video ID.
function findVideoID(url){
    var videoIDIdentifier = "v=";
    var index = url.indexOf(videoIDIdentifier); // search for the index of "v="
    if(index == -1) return null;
    var idBeginIndex = index + videoIDIdentifier.length; // this the index that the video ID begins in the URL
    var videoID = url.substring(idBeginIndex); // get the video ID
    return videoID;
}

// main purpose is to take a url and try to find the word "youtube" in it to make sure it's a youtube video
function findWord(word, url){
    var regex = new RegExp(word, "g");
    return regex.test(url);
}

// take the input of the folders from the HTML form and parse every folder name, which is separated by a comma.
function parseFolders(names){
    folderNamesList = names.split(","); // transform "Music, Music 2, Music 3" to ["Music", " Music 2", " Music 3"]
    folderNamesList = folderNamesList.map(folderName => folderName.trim()); // trim leading/trailing whitespace i.e. transform ["Music", " Music 2", " Music 3"] to ["Music", "Music 2", "Music 3"]
    backgroundPage.console.log(folderNamesList);
}

// calls the main program into action once the window loads and the user clicks the "Make playlist!" button
window.onload = function(){
    window.document.getElementById("bookmarksButton").addEventListener('click', getBookmarks, true);

    const foldersForm = window.document.getElementById("foldersForm")
    foldersForm.addEventListener('keydown', function(keyPressEvent){
        pressedKeyCode = keyPressEvent.which || keyPressEvent.keyCode; // both are deprecated, but .code doesn't work in Chrome v79.0.3945.117
        if(pressedKeyCode === 13) getBookmarks(); // user hit the 'Enter' key
    })
    foldersForm.focus(); // ensures the foldersForm element is the one that's activated when the 'Enter' key is hit; also always the user to type immediately without clicking in the input field
}
