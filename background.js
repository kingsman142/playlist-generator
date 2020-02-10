/*
James Hahn, 2016
*/

var bookmarkIds = []; // YouTube video IDs of each bookmark
var removeScrollbars = true; // should we remove scrollbars once the window is generated?
var availableSongs = []; // list of songs current available in the queue; play every song once, then refill the queue
var bannedSongs = new Set();
var currentVideoId = null; // video ID of the video currently playing in the window

var currentTime = 0; // current number of seconds we have played in the video
var endTime = 0; // total number of seconds there are in the video

// main function to run the program
function startPlaylist(bookmarksId){
    bookmarkIds = bookmarksId;
    chrome.windows.create({
        url: "https://www.youtube.com/watch?v=" + getRandomSongId(),
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
            console.log("Removing scrollbars");
            removeScrollbars = false;
        });
    }

    chrome.tabs.executeScript(tabs[0].id, {
        code:  `var currentTime = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('aria-valuenow');
                var endTime = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('aria-valuemax');
                var availability = document.getElementsByClassName('reason').length;
                [currentTime, endTime, availability]`
    },  function(results){
            if(chrome.runtime.lastError) return;

            try{
                currentTime = results[0][0]; // current time in the player
                endTime = results[0][1]; // end time of the player
                availability = results[0][2]; // check if the player has any HTML reasons with "reasons" why a video is unavailable

                if((currentTime == endTime && endTime != 0) || availability >= 1){ // marks the end of the song OR the video is unavailable
                    if(availability.length >= 1 && currentVideoId != null){
                        bannedSongs.add(currentVideoId);
                    }

                    // reset variables for next iteration
                    currentTime = 0;
                    endTime = 0;
                    currentVideoId = getRandomSongId();
                    newURL = "https://www.youtube.com/watch?v=" + getRandomSongId();

                    // load the url of the next video
                    chrome.tabs.update(tabs[0].id, {
                        url: newURL
                    }, function(){
                        setTimeout(function(){ // navigate to the new song
                            currentTime = 0;
                            endTime = 0;
                            removeScrollbars = true;
                            recursePlaylistExec(tabs);
                        }, 2000); // wait at least 2000 sounds before executing this code because we don't want to just refresh instantly
                    });
                } else{
                    setTimeout(function(){
                        recursePlaylistExec(tabs);
                    }, 2000);
                }
            } catch(e){
                console.log(e);

                // reset variables for next iteration
                currentTime = 0;
                endTime = 0;
                currentVideoId = getRandomSongId();
                newURL = "https://www.youtube.com/watch?v=" + currentVideoId;

                chrome.tabs.update(tabs[0].id, {
                    url: newURL
                }, function(){
                    setTimeout(
                        function(){
                            currentTime = 0;
                            endTime = 0;
                            removeScrollbars = true;
                            recursePlaylistExec(tabs);
                        },
                    2000);
                });
            }
        }
    );
}

function getRandomSongId(){
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
