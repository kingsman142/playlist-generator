/*
James Hahn, 2016
*/

var bookmarkIds = []; // YouTube video IDs of each bookmark
var folderNamesList = []; // names of folders where we should search for YouTube bookmarks
var folderNamesLengths = {}; // how many bookmarks are in each folder we're looking for?

var recentPlaylists = []; // a list of recent playlists requested by the user through the extension
var recentPlaylistsSizes = [];

// main function to run the program -- find the YouTube video Ids of the bookmarks in the folders specified by the user
function getBookmarkIds(shuffle = true){
    chrome.bookmarks.getTree(function(bookmarks){ // iterate over the bookmarks on the bookmarks bar
        // No idea why I have to do this, but had to make this change for manifest v3 -- grabs all items on bookmarks bar
        // I think the general flow is:
        //   Chrome [Bookmarks Manager]
        //   -> Bookmarks Manager (0th element)
        //   -> [Bookmarks bar, Other bookmarks] (children)
        //   -> Bookmarks bar (0th element)
        //   -> [x1, x2, x3, ..., xN] (the children a.k.a. all items on bookmarks bar)
        // Old: bookmarks[0]["children"][0]["children"]; new method loops over Bookmarks Bar as well as Other Bookmarks
        bookmarks = bookmarks[0]["children"];

        var folderNamesString = window.document.getElementById("foldersForm").value;
        folderNamesList = parseFolders(folderNamesString);

        for(var j = 0; j < folderNamesList.length; j++){
            bookmarks.forEach(function(folder){
                searchForBookmarks(folder, folderNamesList[j]); // collect all bookmarks in the "Music" folder and put them into the bookmarkIds array
            });
        }

        if(bookmarkIds.length == 0){
            displayEmptyPlaylistError();
            return;
        }
        updateRecentPlaylists(folderNamesList, bookmarkIds.length);

        // must move the main functionality of the program to background.js so the program does not stop after the popup is closed
        chrome.runtime.sendMessage({
            "operation": "startPlaylist",
            "shuffle": shuffle,
            "bookmarkIds": bookmarkIds,
            "folderNamesList": folderNamesList,
            "folderNamesLengths": folderNamesLengths
        });
        resetVariables();

    });
}

function resetVariables(){
    bookmarkIds = []; // YouTube video IDs of each bookmark
    var folderNamesList = []; // names of folders where we should search for YouTube bookmarks
    var folderNamesLengths = {}; // how many bookmarks are in each folder we're looking for?
}

// traverses entire list of bookmarks to find all the folders containing music (specified by user) and then adds every Youtube bookmark to the bookmarkIds array
function searchForBookmarks(folder, title){
    if(!folder.children) return;
    if(folder.title == title) collectBookmarks(folder); // unique instance where the folder the user is searching for is on the root directory of the bookmarks bar

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
                var videoID = findVideoId(child.url); // find the video ID of the video and add it to the bookmarks ID array
                if(videoID != null) bookmarkIds.push(videoID); // find the video ID of the video and add it to the bookmarks ID array
            }
        } else{ // it's a folder
            collectBookmarks(child);
        }
    })

    folderNamesLengths[folder.title] = folder.children.length;
}

// take the input of the folders from the HTML form and parse every folder name, which is separated by a comma
// return a list
function parseFolders(names){
    folderNames = names.split(","); // transform "Music, Music 2, Music 3" to ["Music", " Music 2", " Music 3"]
    folderNames = folderNames.map(folderName => folderName.trim()); // trim leading/trailing whitespace i.e. transform ["Music", " Music 2", " Music 3"] to ["Music", "Music 2", "Music 3"]
    folderNames = folderNames.filter(folderName => folderName.length > 0); // if the user inputs "" into the foldersForm input element, then folderNames will be [""], so just remove any empty strings to get an empty list
    return folderNames;
}

function getRecentPlaylists(){
    chrome.storage.sync.get(['recentPlaylists'],
        function(returnDict){
            if(returnDict !== undefined && "recentPlaylists" in returnDict && returnDict.recentPlaylists instanceof Array && returnDict.recentPlaylists.length == 2){ // recentPlaylists exists, it's an array, and it has two elements
                // check that both elements are Arrays
                if(returnDict.recentPlaylists[0] instanceof Array) recentPlaylists = returnDict.recentPlaylists[0];
                if(returnDict.recentPlaylists[1] instanceof Array) recentPlaylistsSizes = returnDict.recentPlaylists[1];
                console.log(recentPlaylists);
                console.log(recentPlaylistsSizes);
                console.log(" ");
            } else{
                console.warn("ERROR (Playlist Generator): Invalid returnDict.recentPlaylists; resetting both to their default value of empty lists []")
            }

            // make modifications to the popup UI
            var recentPlaylistsList = window.document.getElementById("recentPlaylistsList");
            // add a button for at most the 5 most recent playlists
            // the 5 most recent playlists are managed in updateRecentPlaylists(...)
            for(var i = 0; i < recentPlaylists.length; i++){
                var recentsListItem = document.createElement("div");
                recentsListItem.setAttribute("class", "recentsListItem");
                recentsListItem.setAttribute("id", "recents" + i)
                var recentsListItemButtons = document.createElement("div");
                recentsListItemButtons.setAttribute("id", "recentListItemButtonsDiv");
                var recentsInsertButton = document.createElement("div");
                recentsInsertButton.setAttribute("class", "recentsInsertButton ph-button-insert ph-btn-white");
                var recentsDeleteButton = document.createElement("div");
                recentsDeleteButton.setAttribute("class", "recentsDeleteButton ph-button-delete ph-btn-red");
                var recentsPlaylistSizeText = document.createElement("div");
                recentsPlaylistSizeText.setAttribute("class", "recentPlaylistsSizeText");

                // prepare to add a bunch of elements to the UI for this list item
                recentsInsertButton.appendChild(document.createTextNode(recentPlaylists[i]));
                recentsDeleteButton.appendChild(document.createTextNode("X"));
                recentsPlaylistSizeText.appendChild(document.createTextNode("Size: " + recentPlaylistsSizes[i] + " links"));
                recentsListItem.appendChild(recentsListItemButtons);
                recentsListItemButtons.appendChild(recentsInsertButton);
                recentsInsertButton.insertAdjacentElement('afterend', recentsDeleteButton);
                recentsListItemButtons.insertAdjacentElement('afterend', recentsPlaylistSizeText);

                // when a user clicks a playlist insert button, autofill the playlist form
                recentsInsertButton.addEventListener('click', function(event){ insertPlaylist(event); }, true);
                recentsDeleteButton.addEventListener('click', function(event){ deletePlaylist(event); }, true);

                // update the UI with the new playlist insert and delete buttons
                recentPlaylistsList.appendChild(recentsListItem);
            }
            if(recentPlaylists === undefined || recentPlaylists.length == 0){ // no recent playlists were available, so just display some filler text
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
        chrome.storage.sync.set({"recentPlaylists": [recentPlaylists, recentPlaylistsSizes]}, function(){ console.info("INFO (Playlist Generator): Added " + recentPlaylists[0] + " of length " + numBookmarks + " to recentPlaylists storage!"); })
    }
}

function insertPlaylist(event){
    window.document.getElementById("foldersForm").value = event.target.innerHTML;
    window.document.getElementById("foldersForm").focus();
}

function deletePlaylist(event){
    var playlistName = event.target.previousSibling.innerHTML; // the user clicked an "X" button, so find its sibling and the playlist name in that element
    var playlistIndex = recentPlaylists.indexOf(playlistName);
    if(playlistIndex > -1){
        recentPlaylists.splice(playlistIndex, 1);
        recentPlaylistsSizes.splice(playlistIndex, 1);
    }

    // update recentPlaylists in local storage
    chrome.storage.sync.set({"recentPlaylists": [recentPlaylists, recentPlaylistsSizes]}, function(){ console.info("INFO (Playlist Generator): Removed " + playlistName + " from recentPlaylists storage!"); })

    // finally, remove the HTML element itself on the popup UI
    event.target.parentNode.parentNode.remove(); // take delete button, get recentListItemButtonsDiv, then get recentListItem div, and remove that

    // if we've removed all recent playlists, make sure we add some "No recent playlists!" text
    if(recentPlaylists === undefined || recentPlaylists.length == 0){
        displayNoRecentPlaylistText();
    }
}

// when there are no recent playlists available, fill the popup with filler text saying so
function displayNoRecentPlaylistText(){
    console.info("INFO (Playlist Generator): The recentPlaylists list is empty!")
    var recentPlaylistsList = window.document.getElementById("recentPlaylistsList");
    var recentsListItem = document.createElement("div");
    recentsListItem.setAttribute("class", "recentsListItem");
    var noRecentsErrorText = document.createElement("div");
    noRecentsErrorText.setAttribute("id", "recentsListEmptyText");
    noRecentsErrorText.appendChild(document.createTextNode("No recent playlists!"));
    recentsListItem.appendChild(noRecentsErrorText);
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
        if(pressedKeyCode === 13){
            removeErrorMessages();
            getBookmarkIds(shuffle = true); // user hit the 'Enter' key
        }
    })
    foldersForm.focus(); // ensures the foldersForm element is the one that's activated when the 'Enter' key is hit; also always the user to type immediately without clicking in the input field
}
