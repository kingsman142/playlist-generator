/*
James Hahn, 2016
*/

var bookmarkIds = []; // YouTube video IDs of each bookmark
var folderNamesList = []; // names of folders where we should search for YouTube bookmarks
var backgroundPage = chrome.extension.getBackgroundPage() // keep an active instance of the background page for easy logging

var recentPlaylists = []; // a list of recent playlists requested by the user through the extension
var recentPlaylistsSizes = [];

// main function to run the program -- find the YouTube video Ids of the bookmarks in the folders specified by the user
function getBookmarkIds(shuffle = true){
    chrome.bookmarks.getTree(function(bookmarks){ // iterate over the bookmarks on the bookmarks bar
        var folderNamesString = window.document.getElementById("foldersForm").value;
        folderNamesList = parseFolders(folderNamesString);

        for(var j = 0; j < folderNamesList.length; j++){
            bookmarks.forEach(function(folder){
                searchForBookmarks(folder, folderNamesList[j]); // collect all bookmarks in the "Music" folder and put them into the bookmarkIds array
            })
        }

        backgroundPage.console.log("===== Total # of bookmarks: " + bookmarkIds.length + " =====");
        if(bookmarkIds.length == 0){
            displayEmptyPlaylistError();
            return;
        }
        updateRecentPlaylists(folderNamesList, bookmarkIds.length);

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
            recentPlaylists = returnDict.recentPlaylists[0];
            recentPlaylistsSizes = returnDict.recentPlaylists[1];
            console.log(recentPlaylists);
            console.log(recentPlaylistsSizes);
            console.log(" ");

            // make modifications to the popup UI
            var recentPlaylistsList = window.document.getElementById("recentPlaylistsList");
            for(var i = 0; i < recentPlaylists.length; i++){ // add a button for at most the 5 most recent playlists
                var recentsListItem = document.createElement("div");
                recentsListItem.setAttribute("class", "recentsListItem");
                recentsListItem.setAttribute("id", "recents" + i)
                var recentsInsertButton = document.createElement("div");
                recentsInsertButton.setAttribute("class", "recentsInsertButton ph-button-insert ph-btn-white");
                var recentsDeleteButton = document.createElement("div");
                recentsDeleteButton.setAttribute("class", "recentsDeleteButton ph-button-delete ph-btn-red");
                var recentsPlaylistSizeText = document.createElement("div");
                recentsPlaylistSizeText.setAttribute("class", "recentPlaylistsSizeText");

                recentsInsertButton.appendChild(document.createTextNode(recentPlaylists[i]));
                recentsDeleteButton.appendChild(document.createTextNode("X"));
                recentsPlaylistSizeText.appendChild(document.createTextNode("Size: " + recentPlaylistsSizes[i] + " links"));
                recentsListItem.appendChild(recentsInsertButton);
                recentsInsertButton.insertAdjacentElement('afterend', recentsDeleteButton);
                recentsDeleteButton.insertAdjacentElement('afterend', recentsPlaylistSizeText)

                // when a user clicks a playlist insert button, autofill the playlist form
                recentsInsertButton.addEventListener('click', function(event){ insertPlaylist(event); }, true);
                recentsDeleteButton.addEventListener('click', function(event){ deletePlaylist(event); }, true);

                // update the UI with the new playlist insert and delete buttons
                recentPlaylistsList.appendChild(recentsListItem);
            }
            if(recentPlaylists.length == 0 || recentPlaylists === undefined){ // no recent playlists were available, so just display some filler text
                displayNoRecentPlaylistText();
            }
        }
    )
}

function updateRecentPlaylists(folderNamesList, numBookmarks){
    // update recentPlaylists in local storage
    var folderNamesString = folderNamesList.toString();
    if(folderNamesList.length > 0 && numBookmarks > 0){ // valid folder names
        if(recentPlaylists.includes(folderNamesString)){ // if this list already exists in the previous 5 played playlists, pop it from the array so we can move it to the 'most recent' playlist position
            var folderNamesIndex = recentPlaylists.indexOf(folderNamesString);
            if(folderNamesIndex > -1){
                recentPlaylists.splice(folderNamesIndex, 1);
                recentPlaylistsSizes.splice(folderNamesIndex, 1);
            }
        }
        recentPlaylists.unshift(folderNamesString);
        recentPlaylists = recentPlaylists.slice(0, 5);
        recentPlaylistsSizes.unshift(numBookmarks);
        recentPlaylistsSizes = recentPlaylistsSizes.slice(0, 5);
        chrome.storage.sync.set({"recentPlaylists": [recentPlaylists, recentPlaylistsSizes]}, function(){ console.log("Added " + recentPlaylists[0] + " of length " + numBookmarks + " to recentPlaylists storage!"); })
    }
}

function insertPlaylist(event){
    window.document.getElementById("foldersForm").value = event.toElement.innerHTML;
    window.document.getElementById("foldersForm").focus();
}

function deletePlaylist(event){
    var playlistName = event.toElement.previousSibling.innerHTML; // the user clicked an "X" button, so find its sibling and the playlist name in that element
    var playlistIndex = recentPlaylists.indexOf(playlistName);
    if(playlistIndex > -1){
        recentPlaylists.splice(playlistIndex, 1);
        recentPlaylistsSizes.splice(playlistIndex, 1);
    }

    // update recentPlaylists in local storage
    chrome.storage.sync.set({"recentPlaylists": [recentPlaylists, recentPlaylistsSizes]}, function(){ console.log("Removed " + playlistName + " from recentPlaylists storage!"); })

    // finally, remove the HTML element itself on the popup UI
    event.toElement.parentNode.remove();

    // if we've removed all recent playlists, make sure we add some "No recent playlists! text"
    if(recentPlaylists.length == 0){
        displayNoRecentPlaylistText();
    }
}

// when there are no recent playlists available, fill the popup with filler text saying so
function displayNoRecentPlaylistText(){
    console.log("EMPTY RECENT PLAYLISTS LIST!")
    var recentPlaylistsList = window.document.getElementById("recentPlaylistsList");
    var recentsListItem = document.createElement("div");
    recentsListItem.setAttribute("class", "recentsListItem");
    recentsListItem.appendChild(document.createTextNode("No recent playlists!"));
    recentPlaylistsList.appendChild(recentsListItem);
}

// when a user enters a list of playlist folders and zero bookmarks are found in them, display an error
function displayEmptyPlaylistError(){
    if(window.document.getElementById("playlistTooLongError") !== null) return; // this error already exists

    var inputFieldsDiv = window.document.getElementById("bookmarksButtonShuffle");
    var errorText = document.createElement("div");
    errorText.setAttribute("class", "errorText");
    errorText.setAttribute("id", "playlistTooLongError");
    errorText.appendChild(document.createTextNode("Error: those folders don't contain any YouTube links!"));
    inputFieldsDiv.insertAdjacentElement('beforebegin', errorText);
}

// remove all error messages from the popup
function removeErrorMessages(){
    var errorTextElements = window.document.getElementsByClassName("errorText");
    for(var i = errorTextElements.length-1; i >= 0; i--){
        errorTextElements[i].remove();
    }
}

// calls the main program into action once the window loads and the user clicks the "Make playlist!" button
window.onload = function(){
    getRecentPlaylists();

    // when a user clicks the 'shuffle' or 'in-order' button, start the playlist
    window.document.getElementById("bookmarksButtonShuffle").addEventListener('click', function(){ getBookmarkIds(shuffle = true); }, true);
    window.document.getElementById("bookmarksButtonInOrder").addEventListener('click', function(){ getBookmarkIds(shuffle = false); }, true);

    // when a user focuses on the input form, remove all error messages
    window.document.getElementById("foldersForm").addEventListener('focus', function(){ removeErrorMessages(); });

    const foldersForm = window.document.getElementById("foldersForm")
    foldersForm.addEventListener('keydown', function(keyPressEvent){
        pressedKeyCode = keyPressEvent.which || keyPressEvent.keyCode; // both are deprecated, but .code doesn't work in Chrome v79.0.3945.117
        if(pressedKeyCode === 13) getBookmarkIds(shuffle = true); // user hit the 'Enter' key
    })
    foldersForm.focus(); // ensures the foldersForm element is the one that's activated when the 'Enter' key is hit; also always the user to type immediately without clicking in the input field
}
