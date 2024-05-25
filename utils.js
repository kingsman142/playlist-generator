// takes a Youtube url and returns the video ID (e.g. transforms "https://www.youtube.com/watch?v=XTNPtzq9lxA&feature=youtu.be&t=2" to "XTNPtzq9lxA")
function findVideoId(url){
    url = new URL(url);
    var urlParams = new URLSearchParams(url.search);
    return urlParams.has('v') ? urlParams.get('v') : null
}
