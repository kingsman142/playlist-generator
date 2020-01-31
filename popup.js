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
var bannedSongs = []; // Songs that are unavailable in that country or are dead links

function fetchRandomSong(){
    var rand = Math.floor(Math.random() * booksID.length);
    return booksID[rand];
}

// Main function to run the program
function getBookmarks(){
    chrome.bookmarks.getTree(function(bookmarks){
        var input = window.document.getElementById("foldersForm").value;
        parseFolders(input);

        chrome.windows.create({
            url: "https://www.youtube.com/watch?v=" + fetchRandomSong(),
            type: 'popup',
            width: 465,
            height: 475,
        }, function(window){
            chrome.tabs.query({
                windowId: window.id
            }, function(tabs){
                newURL = "https://www.youtube.com/watch?v=" + fetchRandomSong();
                chrome.tabs.update(tabs[0].id, {
                    url: newURL
                }, function(){
                    var bgPage = chrome.extension.getBackgroundPage();
                    bgPage.startPlaylist(booksID, tabs);
                });
            });
        });

        for(var j = 0; j < folders.length; j++){
            searchForTitle(bookmarks, folders[j], null); // Collect all bookmarks in the "Music" folder and put them into the booksID array
        }

        console.log("===Total # of bookmarks: " + booksID.length + "===");
    });
}

// Traverses entire list of bookmarks to find all the folders containing music (specified by user)
// and then adds every Youtube bookmark to the booksID array
function searchForTitle(bookmarks, title, parent){
    if(parent == null){ // First find the parent folder
        for(var i = 0; i < bookmarks.length; i++){ // Loop through all bookmarks
            if(bookmarks[i].title == title){ // If the item title matches the title of the folder we're looking for ("Music"), proceed
                searchForTitle(bookmarks[i].children, null, bookmarks[i].id); // Loop through all the bookmarks in the folder that we found
                return null;
            } else{
                if(bookmarks[i].children){ // If the item is a folder, it has children
                    searchForTitle(bookmarks[i].children, title, parent);
                }
            }
        }
    } else if(title == null){ // Parent folder is found, now just traverse the bookmarks within

        for(var i = 0; i < bookmarks.length; i++){
            if(findWord("youtube.com", bookmarks[i].url)){
                var videoID = findVideoID(bookmarks[i].url); // Find the video ID of the video and add it to the bookmarks ID array
                if(videoID != null) booksID.push(videoID); // Find the video ID of the video and add it to the bookmarks ID array
            }
        }

        console.log("-----Folder: " + parent + " contains " + bookmarks.length + " songs-----");
        return null;
    }
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
    console.log(folders);
}

//Calls the main program into action once the window loads and the user
//clicks the "Make playlist!" button
window.onload = function(){
    window.document.getElementById("bookmarksButton").addEventListener('click', getBookmarks, true);
}
