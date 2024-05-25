/*
James Hahn, 2016
*/

chrome.runtime.onMessage.addListener((message) => {
    operation = message["operation"];
    console.warn("Background Message - operation: " + operation + ", keys: " + Object.keys(message));

    switch(operation){
        case 'startPlaylist':
            startPlaylist(message);
            break;
        case 'navigateToNewSong':
            tabId = message['tabId']
            console.warn("Background Message - reason: " + message['reason'])

            navigateToNewSong(tabId);
            break;
        default:
            console.warn("Unrecognized operation. Aborting.");
            break;
    }
});

const GET_AVAILABILITY_WAIT_LENGTH = 7000; // wait this many milliseconds before checking if the song has an unavailability error; NEVER REMOVE because we need to wait for the DOM to load
const NAVIGATION_WAIT_LENGTH = 5000; // wait at least NAVIGATION_WAIT_LENGTH milliseconds before navigating to a new URL; NEVER REMOVE
const WINDOW_WIDTH = 485;
const WINDOW_HEIGHT = 475;

// bookmarkIds keeps track of all possible songs we can use, even after we've looped through them all. availableSongs keeps track of which songs we haven't played yet.
var bookmarkIds = []; // YouTube video IDs of each bookmark
var availableSongs = []; // list of songs currently available in the queue; play every song once, then refill the queue
var bannedSongs = new Set();

var shuffle = true; // default value -- should we iterate through the songs randomly or in-order?

function saveData(tabId){
    chrome.storage.local.set({
        "tabId": tabId,
        "bookmarkIds": bookmarkIds,
        "availableSongs": availableSongs,
        "shuffle": shuffle
    });
}

// main function to run the program
function startPlaylist(message){
    shuffle = message["shuffle"];
    bookmarkIds = message["bookmarkIds"];
    folderNamesList = message["folderNamesList"];
    folderNamesLengths = message["folderNamesLengths"];

    console.info("Folder names: " + folderNamesList.toString());
    for(var folderName in folderNamesLengths){
        console.info("INFO (Playlist Generator): Folder \"" + folderName + "\" contains " + folderNamesLengths[folderName] + " links");
    }
    console.info("INFO (Playlist Generator): Total # of songs is " + bookmarkIds.length);

    availableSongs = []; // reset availableSongs list because opening and closing the extension does not empty it; only reloading the extension empties availableSongs

    chrome.storage.local.get(['bannedSongs'],
        function(returnDict){
            console.info("INFO (Playlist Generator): Grabbed banned songs list:");
            if(returnDict !== undefined && "bannedSongs" in returnDict){
                bannedSongs = new Set(returnDict.bannedSongs);
            }
            console.log(bannedSongs);
            console.log(" ");

            var nextSongId = getNextSongId(); // video ID of the video currently playing in the window
            chrome.windows.create({
                    url: "https://www.youtube.com/watch?v=" + nextSongId,
                    type: 'popup',
                    width: WINDOW_WIDTH,
                    height: WINDOW_HEIGHT,
                }, function(window){
                    chrome.tabs.query({
                            windowId: window.id
                        }, function(tabs){
                            // DO NOT REMOVE TIMEOUT - If this is removed, chrome.runtime errors will be thrown because the window
                            // was not given enough time to load before querying it.
                            setTimeout(function(){
                                saveData(tabs[0].id);
                                checkSongAvailability(tabs[0].id, nextSongId); // pass in the ID of the Google Chrome tab created by this window
                            }, NAVIGATION_WAIT_LENGTH);
                        }
                    );
            });
        }
    );
}

function navigateToNewSong(tabId, grabVariablesFromStorage){
    // grab all extension event data since service worker loses it when it goes inactive
    chrome.storage.local.get(['bannedSongs', 'tabId', 'bookmarkIds', 'availableSongs', 'shuffle'],
        function(returnDict){
            if(returnDict == undefined) return;

            if("bannedSongs" in returnDict) bannedSongs = new Set(returnDict.bannedSongs);
            if("tabId" in returnDict) tabId = returnDict.tabId;
            if("bookmarkIds" in returnDict) bookmarkIds = returnDict.bookmarkIds;
            if("availableSongs" in returnDict) availableSongs = returnDict.availableSongs;
            if("shuffle" in returnDict) shuffle = returnDict.shuffle;

            // reset variables for next iteration
            var nextSongId = getNextSongId();
            var newURL = "https://www.youtube.com/watch?v=" + nextSongId;
            saveData(tabId);

            // load the url of the next video
            chrome.tabs.update(tabId, {
                url: newURL
            }, function(){
                // DO NOT REMOVE TIMEOUT - If this is removed, chrome.runtime errors will be thrown because the window
                // was not given enough time to load before querying it.
                setTimeout(function(){
                    checkSongAvailability(tabId, nextSongId);
                }, NAVIGATION_WAIT_LENGTH);
            });
        }
    );
}

function checkSongAvailability(tabId, songId){
    // This `executeScript` block didn't used to exist here.
    // However, there's an issue where unavailable videos need ~6 seconds for errors to be populated in the DOM for us to extract.
    // But, this forces us to also wait ~7 seconds to add the event listener, for available videos, navigating the page to the next song when it ends.
    // In order to get around this, we optimistically add the event listener if the video is available (available songs) immediately
    //  and make a 2nd attempt after 7 seconds for unavailable songs. This creates a duplication in processing but resolves
    //  poor customer experience and achieves the best of both worlds.
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: setupVideoPlayerData,
        args: [tabId, songId],
    });

    setTimeout(function(){
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: setupVideoPlayerData,
            args: [tabId, songId],
        }, function(results){
                if(chrome.runtime.lastError){
                    console.log("chrome.runtime.lastError");
                    console.log(chrome.runtime.lastError);
                    console.log("Aborting...");
                    return;
                }

                try{
                    // e.g. [{"frameId":0,"result":["1","229",false]}] or [{"frameId":0,"result":[false]}]
                    const scriptReturnValue = results[0]["result"];
                    const unavailable = scriptReturnValue[0]; // check if the player has any HTML reasons with "reasons" why a video is unavailable
                    console.log("Unavailable: " + unavailable);

                    if(unavailable){ // video is unavailable so ban/skip the song
                        bannedSongs.add(songId);
                        console.warn("(Playlist Generator): Banning song " + songId)
                        console.warn(bannedSongs)
                        chrome.storage.local.set({
                            "bannedSongs": Array.from(bannedSongs)
                        }, function(){
                            console.warn("Updated banned songs list");
                            setTimeout(function(){
                                navigateToNewSong(tabId);
                            }, NAVIGATION_WAIT_LENGTH);
                        });
                    }
                } catch(e){ // an exception occurred
                    setTimeout(function(){
                        console.log(e);
                        chrome.runtime.sendMessage({
                            'operation': 'navigateToNewSong',
                            'tabId': tabId,
                            'reason': 'songException'
                        });
                    }, NAVIGATION_WAIT_LENGTH);
                }
            }
        );
    }, GET_AVAILABILITY_WAIT_LENGTH);
}

async function setupVideoPlayerData(tabId, songId){
    const currSongId = ( await chrome.storage.local.get(["currSongId"]) ).currSongId;
    // If the user is skipping through songs within the 7s timeout period,
    //  the timeout for the previous song will hit this code even if we've now switched to an available song.
    // As such, the timeout ends for songId (time to check availability), but we're not currently on a different song,
    //  consider that previous availability check invalid and return false so we don't skip the current song.
    if (songId !== currSongId) {
        return [false]; // we don't want to ban the wrong song; this one is available
    }


    var unavailable = document.getElementById('reason') instanceof Object;
    // let the extension know when a video is finished playing, rather than polling every second
    // this saves computational resources
    const video = document.querySelector('video');
    video.addEventListener('ended', function(){
        chrome.runtime.sendMessage({
            'operation': 'navigateToNewSong',
            'tabId': tabId,
            'reason': 'songEnded'
        });
    });
    return [unavailable];
}

function getNextSongId(){
    if(availableSongs.length == 0){
        populateAvailableSongs();
        console.log("Resetting list of songs!");
    }

    var newSongIndex = availableSongs[0];
    availableSongs.splice(0, 1);
    const newSongId = bookmarkIds[newSongIndex];
    console.warn("(Playlist Generator): Chose song at index: " + newSongIndex + ", ID: " + newSongId + ", available songs: " + availableSongs.length);
    chrome.storage.local.set({ "currSongId": newSongId });
    return newSongId;
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
    if(shuffle) {
        // Shuffle songs once with Fisher-Yates algorithm
        var newSongId, tmp, endOfListIndex;
        for (endOfListIndex = availableSongs.length - 1; endOfListIndex > 0; endOfListIndex--) {
            newSongId = Math.floor(Math.random() * (endOfListIndex + 1));
            tmp = availableSongs[endOfListIndex];
            availableSongs[endOfListIndex] = availableSongs[newSongId];
            availableSongs[newSongId] = tmp;
        }
    }
}
