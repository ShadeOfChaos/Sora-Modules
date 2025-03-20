//***** LOCAL TESTING
// (async() => {
// const results = await searchResults();
// const details = await extractDetails();
// const episodes = await extractEpisodes();
// const streamUrl = await extractStreamUrl();
// console.log('STREAMURL:', streamUrl);
// })();
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const episodeListUrl = 'https://www.animeonsen.xyz/details/VW2uXR5DvjxlLSw5';

    return JSON.stringify([{ title: 'Test show', image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/ofchaos.jpg', href: 'https://www.animeonsen.xyz/details/VW2uXR5DvjxlLSw5' }]);
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const details = {
        description: 'Test show',
        aliases: '',
        airdate: ''
    }

    return JSON.stringify([details]);
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const episodeUrl = 'https://www.animeonsen.xyz/watch/VW2uXR5DvjxlLSw5?episode=1';

    return JSON.stringify([{
        href: episodeUrl,
        number: 1
    }]);
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    url = 'https://www3.animeflv.net/ver/honey-lemon-soda-11'; // TEMP
    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const json = getVideos(html);
        if (json == null) throw ('Error parsing video data');
        // Try to get stream here first so you don't waste time
        
        const streamSource = await decideStreamUrl(json, 'SUB');
        console.log('Stream source:', streamSource);

        // Let's test this shiiiiiiit
        const MAIL_RU = "https://my.mail.ru/mail/aylaz9ymde/_myvideo/9299"; // movieSrc
        const NETU = "https://4fw4gd.cfglobalcdn.com/secip/1/861rQM940fF8R1fZDCdglg/OTQuMjUuMTcwLjI2/1606597200/hls-vod-s03/flv/api/files/videos/2018/08/01/153311550983uua.mp4.m3u8"; // olplayer.src.src
        const STAPE = "https://streamtape.com/e/BP1BrzYvoYfyoJ0/"; // Metadata OR srclink
        const STAPE2 = "https://streamtape.com/get_video?id=BP1BrzYvoYfyoJ0&expires=1742529212&ip=F0qWKRSSDy9XKxR&token=lXYQ3CHwxyza&stream=1";
        const SW = "https://eewh6zs51u.cdn-centaurus.com/hls2/01/09130/fn8n5g7b2i68_,l,n,.urlset/master.m3u8?t=OXR_ic53qjtnGRskLEJqnIAQXJV2PKNEg83I5-JJRyU&s=1742459210&e=129600&f=45652619&srv=mhe7qdnw6bsc&i=0.4&sp=500&p1=mhe7qdnw6bsc&p2=mhe7qdnw6bsc&asn=62240"; // P.A.C.K.E.D
        const YOUR_UPLOAD = "https://vidcache.net:8161/a20250320uQ2qsMaL8jr/video.mp4"; // Metadata OR jwplayerOptions.file

        // return JSON.stringify({ stream: MAIL_RU, subtitles: null });
        // return JSON.stringify({ stream: NETU, subtitles: null });
        // return JSON.stringify({ stream: STAPE, subtitles: null });
        // return JSON.stringify({ stream: STAPE2, subtitles: null });
        // return JSON.stringify({ stream: SW, subtitles: null });
        return JSON.stringify({ stream: YOUR_UPLOAD, subtitles: null });
        

    } catch(e) {
        console.log('Error:', e);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

function getVideos(html) {
    const REGEX = /var videos = ({[\s\S]+?);/;
    const match = html.match(REGEX);

    if (match == null) return null;
    const jsonString = match[1];

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.log('Error parsing videos json');
        return null;
    }
}


async function decideStreamUrl(JSON, expectedFormat = 'SUB') {
    for(let source of JSON.SUB) {
        if(source.title == 'MEGA') continue; // Skip over mega, only use this as a last resort due to conversion being required

        var headers = {};
        if(source?.url != null) headers['Referer'] = source.url;

        let res = await fetch(source.code, {
            method: 'GET',
            headers: headers
        });
        let html = await res.text();

        writeFile(source.title + '.html', html);
    }

    return null;
}

import fs from 'node:fs';
function writeFile(title, content) {
    fs.writeFile('debug/AnimeFLV/' + title, content, err => {
        if (err) {
            console.log('Failed to write to file', err.message);
        } else {
            console.log('Successfully saved file: ', title);
        }
    });
}