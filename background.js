/*
James Hahn, 2016

I gained inspiration for this project from a problem of mine that I recognized:
I had too many Youtube bookmarks of my favorite songs, yet no way to play them all efficiently;
so, my solution was to make my own playlist so I can enjoy literally hundreds of hours of music (turns out I had ~1860 bookmarks, wow).
This program utilizes JavaScript to create a chrome extension, accessing a user's
bookmarks on the current computer. These bookmarks are then stored, and Google Chrome API
is used to execute scripts on a new chrome tab, which loops through the bookmarks.
*/

var bookmarkIds = [];
var removeScrollbars = true;
var availableSongs = [];
var bannedSongs = new Set();
var currentVideoID = null;

var current = 0;
var end = 0;

// main function to run the program
function startPlaylist(bookmarksId){
    bookmarkIds = bookmarksId;
    chrome.windows.create({
        url: "https://www.youtube.com/watch?v=" + fetchRandomSong(),
        type: 'popup',
        width: 485,
        height: 475,
    }, function(window){
      chrome.tabs.query({
          windowId: window.id
      }, function(tabs){
        setTimeout(function() {
          recursePlaylistExec(tabs);
      }, 2000)
      })
    })
}

function recursePlaylistExec(tabs){
    if(removeScrollbars){
        chrome.tabs.executeScript(tabs[0].id, {
            code: "document.getElementsByTagName('html')[0].style.overflow = 'hidden';"
        }, function(){
            console.log("removing scrollbars");
            removeScrollbars = false;
        });
    }

    chrome.tabs.executeScript(tabs[0].id, {
        code: "var current = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('aria-valuenow'); var end = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('aria-valuemax'); var availability = document.getElementsByClassName('reason').length; [current, end, availability]"
    },  function(results){
            if(chrome.runtime.lastError) return;

            try{
                current = results[0][0]; // current time in the player
                end = results[0][1]; // end time of the player
                availability = results[0][2]; // check if the player has any HTML reasons with "reasons" why a video is unavailable

                if((current == end && end != 0) || availability >= 1){ // marks the end of the song OR the video is unavailable
                    if(availability.length >= 1 && currentVideoID != null){
                        bannedSongs.add(currentVideoID);
                        currentVideoID = null;
                    }

                    current = 0;
                    end = 0;
                    currentVideoID = fetchRandomSong();
                    newURL = "https://www.youtube.com/watch?v=" + currentVideoID;
                    chrome.tabs.update(tabs[0].id, {
                        url: newURL
                    }, function(){
                        setTimeout(function(){ // navigate to the new song
                            current = 0;
                            end = 0;
                            removeScrollbars = true;
                            recursePlaylistExec(tabs);
                        }, 2000); // wait at least 1000 sounds before executing this code because we don't want to just refresh instantly
                    });
                } else{
                    setTimeout(function(){
                        recursePlaylistExec(tabs);
                    }, 2000);
                }
            } catch(e){
                current = 0;
                end = 0;
                console.log(e);
                currentVideoID = fetchRandomSong();
                newURL = "https://www.youtube.com/watch?v=" + currentVideoID;
                chrome.tabs.update(tabs[0].id, {
                    url: newURL
                }, function(){
                    setTimeout(
                        function(){
                            current = 0;
                            end = 0;
                            removeScrollbars = true;
                            recursePlaylistExec(tabs);
                        },
                    2000);
                });
            }
        }
    );
}

function fetchRandomSong(){
    if(availableSongs.length <= 2){
        populateAvailableSongs();
        console.log("Resetting list of songs!");
    }

    var rand = Math.floor(Math.random() * availableSongs.length);
    var newSongIndex = availableSongs[rand];
    availableSongs.splice(rand, 1);
    console.log("Chose song at index: " + newSongIndex + ", ID: " + bookmarkIds[newSongIndex] + ", available songs: " + availableSongs.length);
    return bookmarkIds[newSongIndex];
}

function removeBannedSongs(){
    var goodSongs = bookmarkIds.filter(x => !bannedSongs.has(x));
    bookmarkIds = Array.from(goodSongs);
}

function populateAvailableSongs(){
    removeBannedSongs();
    for(var i = 0; i < bookmarkIds.length; i++){
        availableSongs.push(i);
    }
}
