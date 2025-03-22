//***** LOCAL TESTING
// const results = await searchResults('Solo leveling');
// const details = await extractDetails(JSON.parse(results)[1].href);
// const episodes = await extractEpisodes(JSON.parse(results)[1].href);
// const streamUrl = await extractStreamUrl(JSON.parse(episodes)[0].href);
// console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const SEARCH_URL = 'https://v6.kuramanime.run/anime?search=';
    const REGEX = /data-setbg="([\s\S]+?)"[\s\S]+?<h5><a href="([\s\S]+?)"[\s\S]*?>([\s\S]+?)</g;
    var shows = [];

    try {
        const response = await fetch(`${SEARCH_URL}${encodeURI(keyword)}`);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'id="animeList', 'id="filterLoading');

        const matches = trimmedHtml.matchAll(REGEX);

        for (let match of matches) {
            shows.push({
                title: match[3],
                image: match[1],
                href: match[2]
            });
        }

        return JSON.stringify(shows);
    } catch (error) {
        console.log('Fetch error:' + error.message);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const REGEX = /\/h3>\s*<span>([\s\S]*?)<[\s\S]+?id="synopsisField"[\s\S]*?>([\s\S]*?)<\/p[\s\S]+?Musim:[\s\S]+?a href[\s\S]+?>([\s\S]*?)</;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'class="anime__details__text', 'id="episodeBatchListsSection"');

        const match = trimmedHtml.match(REGEX);

        const details = {
            description: cleanSynopsis(match[2]),
            aliases: match[1],
            airdate: match[3]
        }

        return JSON.stringify([details]);

    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const REGEX = /<a class[\s\S]*?href='([\s\S]*?)'[\s\S]*?>\s*Ep ([0-9]*)/g;

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const trimmedHtml = trimText(html, 'id="episodeLists', 'id="episodeBatchListsSection');

        const episodes = Array.from(trimmedHtml.matchAll(REGEX)).map(m => {
            return {
                href: m[1].trim(),
                number: parseInt(m[2])
            }
        });

        return JSON.stringify(episodes);

    } catch (error) {
        console.log('Fetch error:' + error.message);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    const BASE_URL = 'https://v6.kuramanime.run/';
    const kpsRegex = /data-kps="([\s\S]*?)"/

    try {
        const response = await fetch(url);
        const html = typeof response === 'object' ? await response.text() : await response;

        const kpsMatch = html.match(kpsRegex);

        if(kpsMatch == null || kpsMatch[1] == null) {
            throw('Failed to capture kps data key');
        }

        const kps = kpsMatch[1]; // f




        // Gets the 'env' from the txt file [MIX_PREFIX_AUTH_ROUTE_PARAM, MIX_AUTH_ROUTE_PARAM, MIX_AUTH_KEY, MIX_AUTH_TOKEN, MIX_PAGE_TOKEN_KEY, MIX_STREAM_SERVER_KEY]
        // const scriptResponse = await fetch(`https://v6.kuramanime.run/assets/js/${ kps }.js`);
        // const js = typeof scriptResponse === 'object' ? await scriptResponse.text() : await scriptResponse;

        // console.log(js);
        const MIX_AUTH_KEY = "snWwNGMvBuHATEf";
        const MIX_AUTH_ROUTE_PARAM = "VShKkA7y8EKMg4l.txt";
        const MIX_AUTH_TOKEN = "WXTOBUbcRjxDSdd";
        const MIX_PAGE_TOKEN_KEY = "GsO426IM48NzYIg";
        const MIX_PREFIX_AUTH_ROUTE_PARAM = "assets/";
        const MIX_STREAM_SERVER_KEY = "imi6b0f8oQPbXWd";




        // Get access token
        const accessTokenResponse = await fetch(`${ BASE_URL }${ MIX_PREFIX_AUTH_ROUTE_PARAM }${ MIX_AUTH_ROUTE_PARAM }`, {
            method: 'GET',
            headers: {
                "X-Fuck-ID": `${ MIX_AUTH_KEY }:${ MIX_AUTH_TOKEN }`,
                "X-Request-ID": generateRandomString(6),
                "X-Request-Index": 0,
                "X-CSRF-TOKEN": "s2pxmYBRqf9ZeYLnitdeeTFSvhZVp8uQABn5mQu3"
            }
        });
        const accessToken = typeof accessTokenResponse === 'object' ? await accessTokenResponse.text() : await accessTokenResponse;

        const streamUrlResponse = `${ url }?${ MIX_PAGE_TOKEN_KEY }=${ accessToken }&${ MIX_STREAM_SERVER_KEY }=kuramadrive&page=1`;
        // const streamUrl = typeof accessTokenResponse === 'object' ? await accessTokenResponse.text() : await accessTokenResponse;

        console.log(streamUrlResponse);

        return streamUrlResponse;

        // f = nzPZDajlscE1Qwc (data-kps value)
        // https://v6.kuramanime.run/assets/js/${f}.js

        // Get from data-kps="nzPZDajlscE1Qwc"
        // "https://v6.kuramanime.run/anime/2475/ore-dake-level-up-na-ken/episode/1?GsO426IM48NzYIg=i72nm4qSP3&imi6b0f8oQPbXWd=kuramadrive&page=1"

        // const MIX_AUTH_KEY = "snWwNGMvBuHATEf";
        // const MIX_AUTH_ROUTE_PARAM = "VShKkA7y8EKMg4l.txt";
        // const MIX_AUTH_TOKEN = "WXTOBUbcRjxDSdd";
        // const MIX_PAGE_TOKEN_KEY = "GsO426IM48NzYIg";
        // const MIX_PREFIX_AUTH_ROUTE_PARAM = "assets/";
        // const MIX_STREAM_SERVER_KEY = "imi6b0f8oQPbXWd";
        // const MIX_JS_ROUTE_PARAM_ATTR = "data-kps"
        // const MIX_JS_ROUTE_PARAM_ATTR_KEY = "49C72148FE4F7"

        // Get access token
        // url = https://v6.kuramanime.run/assets/VShKkA7y8EKMg4l.txt
        // f = snWwNGMvBuHATEf
        // g = WXTOBUbcRjxDSdd
        // h = 0
        // headers: {
        //     "X-Fuck-ID": `${f}:${g}`,
        //     "X-Request-ID": generateRandomString(6),
        //     "X-Request-Index": h
        //     "X-CSRF-TOKEN": "s2pxmYBRqf9ZeYLnitdeeTFSvhZVp8uQABn5mQu3"
        // }
        // 
        // function generateRandomString(a) {
        //     let b = "";
        //     const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".length;
        //     for (let d = 0; d < a; d++)
        //         b += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * c));
        //     return b
        // }
        //
        // Result i72nm4qSP3 (String)
        //
        // OnSuccess
        //
        // const c = new URL(a.to = https://v6.kuramanime.run/anime/2475/ore-dake-level-up-na-ken/episode/1); // Watch url
        // c.searchParams.set(process.env.MIX_PAGE_TOKEN_KEY, b = i72nm4qSP3),
        // c.searchParams.set(process.env.MIX_STREAM_SERVER_KEY, streamServer = 'kuramadrive'),
        // c.searchParams.set("page", a.page = 0)

        

        // Fetch the stream url from within html and return it through streamUrl
        // console.log(html);

        return atob('aHR0cHM6Ly9tdXRzdW1pLm15LmlkL2tkcml2ZS8wQm0ybHNVY1pzZi9LdXJhbWFuaW1lLVNPTE9MVkxfQkQtMDEtNzIwcC1LdXJhbWFCRC5tcDQ/Z2lkPTFXWVdXeHBUZHlZQW9tSko1cThhaGtRMmxvWEZfYUhtdCZpZD02NzE2MzM2NjY5MDEtMzB1OWpnMW51NWNtY2NzZDljMHBnaXJscnNrZmI5YnQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20mc2M9R09DU1BYLURzaUR0UDVMcTlFNzUyOUlIaXVWVDFyRHY1Y0gmcnQ9MS8vMDNLR1lyVnZhWG52YkNnWUlBUkFBR0FNU053Ri1MOUlyREVIaUtOOXBTRXJ6NXkydE9BX0wtV0NrLS1rWFg4WHZ5bDNoWWNkaVFjLTdyQ1RJT0tLUGJDXzNOeUpMY25wdGl4RSZjY2U9MQ==');

    } catch(e) {
        console.log('Error:' + e.message);
        return null;
    }
}

function trimText(text, startString, endString) {
    const startIndex = text.indexOf(startString);
    const endIndex = text.indexOf(endString, startIndex);
    return text.substring(startIndex, endIndex);
}

function cleanSynopsis(html) {
    return html.replaceAll('<br>', '\n').replaceAll('<i>', '').replaceAll('</i>', '');
}

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}

function generateRandomString(a) {
    let b = "";
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".length;
    for (let d = 0; d < a; d++)
        b += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * c));
    return b
}