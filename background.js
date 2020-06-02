/*
James Hahn, 2016
*/

const TIMEOUT_LENGTH = 2000; // wait at least TIMEOUT_LENGTH milliseconds before navigating to a new URL
const WINDOW_WIDTH = 485;
const WINDOW_HEIGHT = 475;

var bookmarkIds = []; // YouTube video IDs of each bookmark
var availableSongs = []; // list of songs current available in the queue; play every song once, then refill the queue
var bannedSongs = new Set();
var currentVideoId = null; // video ID of the video currently playing in the window

var currentTime = 0; // current number of seconds we have played in the video
var endTime = 0; // total number of seconds there are in the video

// main function to run the program
function startPlaylist(bookmarksId){
    bookmarkIds = bookmarksId;

    chrome.storage.sync.get(['bannedSongs'],
        function(returnDict){
            console.log("Grabbed banned songs list:");
            bannedSongs = new Set(returnDict.bannedSongs);
            console.log(bannedSongs);
            console.log(" ");

            currentVideoId = getRandomSongId()
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
                var availability = document.getElementsByClassName('reason').length;
                [currentTime, endTime, availability]`
    },  function(results){
            if(chrome.runtime.lastError) return;

            try{
                currentTime = results[0][0]; // current time in the player
                endTime = results[0][1]; // end time of the player
                availability = results[0][2]; // check if the player has any HTML reasons with "reasons" why a video is unavailable

                if((currentTime == endTime && endTime != 0) || availability >= 1){ // marks the end of the song OR the video is unavailable
                    if(availability >= 1){
                        bannedSongs.add(currentVideoId);
                        console.log("Banning song " + currentVideoId)
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
    currentVideoId = getRandomSongId();
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

function getRandomSongId(){
    if(availableSongs.length == 0){
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
