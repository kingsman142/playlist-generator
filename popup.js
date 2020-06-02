/*
James Hahn, 2016
*/

var bookmarkIds = []; // YouTube video IDs of each bookmark
var folderNamesList = []; // names of folders where we should search for YouTube bookmarks
var backgroundPage = chrome.extension.getBackgroundPage() // keep an active instance of the background page for easy logging
var recentPlaylists = []; // a list of recent playlists requested by the user through the extension

// main function to run the program -- find the YouTube video Ids of the bookmarks in the folders specified by the user
function getBookmarkIds(shuffle = true){
    chrome.bookmarks.getTree(function(bookmarks){ // iterate over the bookmarks on the bookmarks bar
        var folderNamesString = window.document.getElementById("foldersForm").value;
        folderNamesList = parseFolders(folderNamesString);

        // update recentPlaylists in local storage
        var folderNamesString = folderNamesList.toString();
        console.log("folder names string: " + folderNamesString);
        if(folderNamesList.length > 0){ // valid folder names
            if(recentPlaylists.includes(folderNamesString)){ // if this list already exists in the previous 5 played playlists, pop it from the array so we can move it to the 'most recent' playlist position
                var folderNamesIndex = recentPlaylists.indexOf(folderNamesString);
                if(folderNamesIndex > -1) recentPlaylists.splice(folderNamesIndex, 1);
            }
            console.log(recentPlaylists);
            recentPlaylists.unshift(folderNamesString);
            console.log(recentPlaylists);
            recentPlaylists = recentPlaylists.slice(0, 5);
            console.log(recentPlaylists);
            chrome.storage.sync.set({"recentPlaylists": recentPlaylists}, function(){ console.log("Added " + recentPlaylists[0] + " to recentPlaylists storage!"); })
        }

        for(var j = 0; j < folderNamesList.length; j++){
            bookmarks.forEach(function(folder){
                searchForBookmarks(folder, folderNamesList[j]); // collect all bookmarks in the "Music" folder and put them into the bookmarkIds array
            })
        }

        backgroundPage.console.log("===== Total # of bookmarks: " + bookmarkIds.length + " =====");

        var bgPage = backgroundPage;
        bgPage.shuffle = shuffle;
        bgPage.bookmarkIds = bookmarkIds
        bgPage.startPlaylist(); // must move the main functionality of the program to background.js so the program does not stop after the popup is closed
    });
}

// traverses entire list of bookmarks to find all the folders containing music (specified by user) and then adds every Youtube bookmark to the bookmarkIds array
function searchForBookmarks(folder, title){
    folder.children.forEach(function(child){ // loop through all bookmarks
        if(child.title == title){ // if the item title matches the title of the folder we're looking for ("Music"), proceed
            collectBookmarks(child); // loop through all the bookmarks in the folder that we found
        } else if(child.children){ // if the item is a folder, it has children
            searchForBookmarks(child, title);
        } // else, this is a regular bookmark that does not belong to the folder(s) we are looking for
    })
}
function collectBookmarks(folder){
    folder.children.forEach(function(child){
        if(child.url){
            if(child.url.includes("youtube.com")){ // make sure this is a youtube link
                var videoID = findVideoID(child.url); // find the video ID of the video and add it to the bookmarks ID array
                if(videoID != null) bookmarkIds.push(videoID); // find the video ID of the video and add it to the bookmarks ID array
            }
        } else{ // it's a folder
            collectBookmarks(child)
        }
    })

    backgroundPage.console.log("=== Folder: " + folder.title + " contains " + folder.children.length + " songs ===");
}

// takes a Youtube url and returns the video ID (e.g. transforms "https://www.youtube.com/watch?v=XTNPtzq9lxA&feature=youtu.be&t=2" to "XTNPtzq9lxA")
function findVideoID(url){
    url = new URL(url);
    var urlParams = new URLSearchParams(url.search);
    return urlParams.has('v') ? urlParams.get('v') : null
}

// take the input of the folders from the HTML form and parse every folder name, which is separated by a comma.
function parseFolders(names){
    folderNames = names.split(","); // transform "Music, Music 2, Music 3" to ["Music", " Music 2", " Music 3"]
    folderNames = folderNames.map(folderName => folderName.trim()); // trim leading/trailing whitespace i.e. transform ["Music", " Music 2", " Music 3"] to ["Music", "Music 2", "Music 3"]
    backgroundPage.console.log(folderNames);
    return folderNames;
}

function getRecentPlaylists(){
    chrome.storage.sync.get(['recentPlaylists'],
        function(returnDict){
            console.log("Grabbed recent playlists:");
            recentPlaylists = returnDict.recentPlaylists;
            console.log(recentPlaylists);
            console.log(" ");

            // make modifications to the popup UI
            var recentPlaylistsList = window.document.getElementById("recentPlaylistsList");
            for(var i = 0; i < recentPlaylists.length; i++){
                var recentsListItem = document.createElement("div");
                recentsListItem.setAttribute("class", "recentsListItem");
                var recentsInsertButton = document.createElement("div");
                recentsInsertButton.setAttribute("class", "recentsInsertButton ph-button-insert ph-btn-white");
                var recentsDeleteButton = document.createElement("div");
                recentsDeleteButton.setAttribute("class", "recentsDeleteButton ph-button-delete ph-btn-red");

                recentsInsertButton.appendChild(document.createTextNode(recentPlaylists[i]));
                recentsDeleteButton.appendChild(document.createTextNode("X"));
                recentsListItem.appendChild(recentsInsertButton);
                recentsInsertButton.insertAdjacentElement('afterend', recentsDeleteButton);

                recentPlaylistsList.appendChild(recentsListItem);
            }
            if(recentPlaylists.length == 0 || recentPlaylists === undefined){
                console.log("EMPTY RECENT PLAYLISTS LIST!")
                recentPlaylistsList.appendChild(document.createTextNode("No recent playlists"))
            }
        }
    )
}

// calls the main program into action once the window loads and the user clicks the "Make playlist!" button
window.onload = function(){
    getRecentPlaylists();

    window.document.getElementById("bookmarksButtonShuffle").addEventListener('click', function(){ getBookmarkIds(shuffle = true); }, true);
    window.document.getElementById("bookmarksButtonInOrder").addEventListener('click', function(){ getBookmarkIds(shuffle = false); }, true);

    const foldersForm = window.document.getElementById("foldersForm")
    foldersForm.addEventListener('keydown', function(keyPressEvent){
        pressedKeyCode = keyPressEvent.which || keyPressEvent.keyCode; // both are deprecated, but .code doesn't work in Chrome v79.0.3945.117
        if(pressedKeyCode === 13) getBookmarkIds(shuffle = true); // user hit the 'Enter' key
    })
    foldersForm.focus(); // ensures the foldersForm element is the one that's activated when the 'Enter' key is hit; also always the user to type immediately without clicking in the input field
}
