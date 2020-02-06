/*
James Hahn, 2016

I gained inspiration for this project from a problem of mine that I recognized:
I had too many Youtube bookmarks of my favorite songs, yet no way to play them all efficiently;
so, my solution was to make my own playlist so I can enjoy literally hundreds of hours of music (turns out I had ~1860 bookmarks, wow).
This program utilizes JavaScript to create a chrome extension, accessing a user's
bookmarks on the current computer. These bookmarks are then stored, and the Google Chrome API
is used to execute scripts on a new chrome tab, which loops through the bookmarks.

Future ideas:
1) Hook up to Spotify API
2) Fix the scrollbars so they are removed faster
3) Add storage to the extension so banned songs are transferred from each session
4) Separate out songs by types/genres and mood for the user
*) Machine. Learning. ;)
*/

var booksID = [];
var folders = [];
var backgroundPage = chrome.extension.getBackgroundPage()

// Main function to run the program
function getBookmarks(){
    chrome.bookmarks.getTree(function(bookmarks){
        var input = window.document.getElementById("foldersForm").value;
        parseFolders(input);

        for(var j = 0; j < folders.length; j++){
            bookmarks.forEach(function(folder){
                searchForBookmarks(folder, folders[j]); // Collect all bookmarks in the "Music" folder and put them into the booksID array
            })
        }

        backgroundPage.console.log("=== Total # of bookmarks: " + booksID.length + " ===");

        var bgPage = backgroundPage;
        bgPage.startPlaylist(booksID);
    });
}

// Traverses entire list of bookmarks to find all the folders containing music (specified by user)
// and then adds every Youtube bookmark to the booksID array
function searchForBookmarks(folder, title){
    folder.children.forEach(function(child){ // Loop through all bookmarks
        if(child.title == title){ // If the item title matches the title of the folder we're looking for ("Music"), proceed
            collectBookmarks(child); // Loop through all the bookmarks in the folder that we found
        } else if(child.children){ // If the item is a folder, it has children
            searchForBookmarks(child, title);
        }
    })
}
function collectBookmarks(folder){
    folder.children.forEach(function(child){
        if(child.url){
          if(findWord("youtube.com", child.url)){
              var videoID = findVideoID(child.url); // Find the video ID of the video and add it to the bookmarks ID array
              if(videoID != null) booksID.push(videoID); // Find the video ID of the video and add it to the bookmarks ID array
          }
        } else{ // it's a folder
            collectBookmarks(child)
        }
    })

    backgroundPage.console.log("-----Folder: " + folder.id + " contains " + folder.children.length + " songs-----");
}

// Takes a Youtube url and returns the video ID.
function findVideoID(url){
    var videoIDIdentifier = "v=";
    var index = url.indexOf(videoIDIdentifier); // search for the index of "v="
    if(index == -1) return null;
    var idBeginIndex = index + videoIDIdentifier.length; // this the index that the video ID begins in the URL
    var videoID = url.substring(idBeginIndex); // get the video ID
    return videoID;
}

// Main purpose is to take a url and try to find
// the word "youtube" in it to make sure it's a youtube video
function findWord(word, url){
    var regex = new RegExp(word, "g");
    return regex.test(url);
}

// Take the input of the folders from the HTML form
// and parse every folder name, which is separated
// by a comma.
function parseFolders(names){
    folders = names.split(",");
    backgroundPage.console.log(folders);
}

// calls the main program into action once the window loads and the user clicks the "Make playlist!" button
window.onload = function(){
    window.document.getElementById("bookmarksButton").addEventListener('click', getBookmarks, true);

    const foldersForm = window.document.getElementById("foldersForm")
    foldersForm.addEventListener('keydown', function(keyPressEvent){
        // https://stackoverflow.com/questions/302122/jquery-event-keypress-which-key-was-pressed claims e.keyCode and e.which are deprecated for e.key
        if(keyPressEvent.which === 13) getBookmarks() // user hit the 'Enter' key
    })
    foldersForm.focus(); // ensures the foldersForm element is the one that's activated when the 'Enter' key is hit; also always the user to type immediately without clicking in the input field
}
