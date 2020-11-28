/*
James Hahn, 2016
*/

const TIMEOUT_LENGTH = 2000; // wait at least TIMEOUT_LENGTH milliseconds before navigating to a new URL
const WINDOW_WIDTH = 485;
const WINDOW_HEIGHT = 475;

// bookmarkIds keeps track of all possible songs we can use, even after we've looped through them all. availableSongs keeps track of which songs we haven't played yet.
var bookmarkIds = []; // YouTube video IDs of each bookmark
var availableSongs = []; // list of songs currently available in the queue; play every song once, then refill the queue
var bannedSongs = new Set();
var currentVideoId = null; // video ID of the video currently playing in the window

var shuffle = true; // default value -- should we iterate through the songs randomly or in-order?
var currSongIndex = 0;

var currentTime = 0; // current number of seconds we have played in the video
var endTime = 0; // total number of seconds there are in the video

// main function to run the program
function startPlaylist(){
    availableSongs = []; // reset availableSongs list because opening and closing the extension does not empty it; only reloading the extension empties availableSongs

    chrome.storage.sync.get(['bannedSongs'],
        function(returnDict){
            console.info("INFO (Playlist Generator): Grabbed banned songs list:");
            if(returnDict !== undefined && "bannedSongs" in returnDict){
                bannedSongs = new Set(returnDict.bannedSongs);
            }
            console.log(bannedSongs);
            console.log(" ");

            currentVideoId = getNextSongId()
            chrome.windows.create({
                url: "https://www.youtube.com/watch?v=" + currentVideoId,
                type: 'popup',
                width: WINDOW_WIDTH,
                height: WINDOW_HEIGHT,
            }, function(window){
              chrome.tabs.query({
                  windowId: window.id
              }, function(tabs){
                setTimeout(function() {
                  recursePlaylistLoop(tabs[0].id); // pass in the ID of the Google Chrome tab created by this window
              }, TIMEOUT_LENGTH)
              })
            })
        }
    )
}

function recursePlaylistLoop(tabId){
    chrome.tabs.executeScript(tabId, {
        code:  `var currentTime = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('aria-valuenow');
                var endTime = document.getElementsByClassName('ytp-progress-bar')[0].getAttribute('aria-valuemax');
                var unavailable = document.getElementById('reason') instanceof Object;
                [currentTime, endTime, unavailable]`
    },  function(results){
            if(chrome.runtime.lastError) return;

            try{
                currentTime = results[0][0]; // current time in the player
                endTime = results[0][1]; // end time of the player
                unavailable = results[0][2]; // check if the player has any HTML reasons with "reasons" why a video is unavailable

                if((currentTime == endTime && endTime != 0) || unavailable == true){ // marks the end of the song OR the video is unavailable
                    if(unavailable == true){
                        bannedSongs.add(currentVideoId);
                        console.warn("WARN (Playlist Generator): Banning song " + currentVideoId)
                        console.log(bannedSongs)
                        console.log(" ")
                        chrome.storage.sync.set({"bannedSongs": Array.from(bannedSongs)}, function(){ console.log("Updated banned songs list"); })
                    }

                    return navigateToNewSong(tabId);
                } else{ // just call this function recursively so we can update the current time variable
                    setTimeout(function(){
                        return recursePlaylistLoop(tabId);
                    }, TIMEOUT_LENGTH);
                }
            } catch(e){ // an exception occurred
                console.log(e);
                return navigateToNewSong(tabId);
            }
        }
    );
}

function navigateToNewSong(tabId){
    // reset variables for next iteration
    currentTime = 0;
    endTime = 0;
    currentVideoId = getNextSongId();
    newURL = "https://www.youtube.com/watch?v=" + currentVideoId;

    // load the url of the next video
    chrome.tabs.update(tabId, {
        url: newURL
    }, function(){
        setTimeout(function(){ // navigate to the new song
            currentTime = 0;
            endTime = 0;
            return recursePlaylistLoop(tabId);
        }, TIMEOUT_LENGTH); // wait at least TIMEOUT_LENGTH milliseconds before executing this code because we don't want to just refresh instantly
    });
}

function getNextSongId(){
    if(availableSongs.length == 0){
        populateAvailableSongs();
        console.log("Resetting list of songs!");
    }

    var availableSongsIndex = 0;
    if(shuffle){ // choose a random song index
        availableSongsIndex = Math.floor(Math.random() * availableSongs.length);
    }

    var newSongIndex = availableSongs[availableSongsIndex];
    availableSongs.splice(availableSongsIndex, 1);
    console.info("INFO (Playlist Generator): Chose song at index: " + newSongIndex + ", ID: " + bookmarkIds[newSongIndex] + ", available songs: " + availableSongs.length);
    return bookmarkIds[newSongIndex];
}

function removeBannedSongs(){
    var goodSongs = bookmarkIds.filter(x => !bannedSongs.has(x));
    bookmarkIds = Array.from(goodSongs);
}

function populateAvailableSongs(){
    removeBannedSongs();
    availableSongs = [];
    for(var i = 0; i < bookmarkIds.length; i++){
        availableSongs.push(i);
    }
}
