///////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Main Functions          //////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const searchApiUrl = `https://aniworld.to/ajax/seriesSearch?keyword=${encodedKeyword}`;

        const response = await soraFetch(searchApiUrl);
        const data = typeof response === 'object' ? await response.json() : await JSON.parse(response);
        
        const transformedResults = data.map(anime => ({
            title: anime.name,
            image: `https://aniworld.to${anime.cover}`,
            href: `https://aniworld.to/anime/stream/${anime.link}`
        }));

        return JSON.stringify(transformedResults);

    } catch (error) {
        console.log('Fetch error:' + error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const fetchUrl = `${url}`;
        const response = await soraFetch(fetchUrl);
        const text = typeof response === 'object' ? await response.text() : await response;

        const descriptionRegex = /<p\s+class="seri_des"\s+itemprop="accessibilitySummary"\s+data-description-type="review"\s+data-full-description="([^"]*)".*?>(.*?)<\/p>/s;
        const aliasesRegex = /<h1\b[^>]*\bdata-alternativetitles="([^"]+)"[^>]*>/i;

        const aliasesMatch = aliasesRegex.exec(text);
        let aliasesArray = [];
        if (aliasesMatch) {
            aliasesArray = aliasesMatch[1].split(',').map(a => a.trim());
        }

        const descriptionMatch = descriptionRegex.exec(text) || [];

        const airdateMatch = "Unknown"; // TODO: Implement airdate extraction

        const transformedResults = [{
            description: descriptionMatch[1] || 'No description available',
            aliases: aliasesArray[0] || 'No aliases available',
            airdate: airdateMatch
        }];

        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:' + error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const baseUrl = 'https://aniworld.to';
        const fetchUrl = `${url}`;
        const response = await soraFetch(fetchUrl);
        const html = typeof response === 'object' ? await response.text() : await response;

        const finishedList = [];
        const seasonLinks = getSeasonLinks(html);

        for (const seasonLink of seasonLinks) {
            const seasonEpisodes = await fetchSeasonEpisodes(`${baseUrl}${seasonLink}`);
            finishedList.push(...seasonEpisodes);
        }

        // Replace the field "number" with the current index of each item, starting from 1
        finishedList.forEach((item, index) => {
            item.number = index + 1;
        });

        return JSON.stringify(finishedList);

    } catch (error) {
        console.log('Fetch error:' + error);
        return JSON.stringify([{ number: '0', href: '' }]);
    }
}


async function extractStreamUrl(url) {
    try {
        const baseUrl = 'https://aniworld.to';
        const fetchUrl = `${url}`;
        const response = await soraFetch(fetchUrl);
        const text = typeof response === 'object' ? await response.text() : await response;

        const finishedList = [];
        const languageList = getAvailableLanguages(text);
        const videoLinks = getVideoLinks(text);

        for (const videoLink of videoLinks) {
            const language = languageList.find(l => l.langKey === videoLink.langKey);
            if (language) {
                finishedList.push({ provider: videoLink.provider, href: `${baseUrl}${videoLink.href}`, language: language.title });
            }
        }

        let firstVideo = null;

        const voeEnglishSub = finishedList.find(video => video.provider === 'VOE' && video.language === 'mit Untertitel Englisch');
        if (voeEnglishSub) {
            firstVideo = voeEnglishSub;
        }
        else {
            firstVideo = finishedList[0];
        }


        const videoResponse = await soraFetch(firstVideo.href);
        const videoPage = typeof videoResponse === 'object' ? await videoResponse.text() : await videoResponse;

        // Extract the link from window.location.href in the script tag
        const scriptRegex = /window\.location\.href\s*=\s*['"]([^'"]+)['"]/;
        const scriptMatch = scriptRegex.exec(videoPage);
        const winLocUrl = scriptMatch ? scriptMatch[1] : '';

        const hlsSourceResponse = await soraFetch(winLocUrl);
        const hlsSourcePage = typeof hlsSourceResponse === 'object' ? await hlsSourceResponse.text() : await hlsSourceResponse;

        if(firstVideo.provider === 'VOE') {
            console.log('Extracting VOE JSON...');
            const voeJson = voeExtractor(hlsSourcePage);

            console.log('Extracted VOE JSON:' + JSON.stringify(voeJson));
            console.log('VOE Source:' + voeJson.source);
            
            return voeJson.source;
        }

        // Extract the sources variable and decode the hls value from base64
        const sourcesRegex = /var\s+sources\s*=\s*({[^}]+})/;
        const sourcesMatch = sourcesRegex.exec(hlsSourcePage);
        let sourcesString = sourcesMatch ? sourcesMatch[1].replace(/'/g, '"') : null;

        // Remove trailing commas
        sourcesString = sourcesString ? sourcesString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']') : null;

        const sources = sourcesString ? JSON.parse(sourcesString) : null;
        if (sources && sources.hls) {
            const hlsBase64 = sources.hls;
            const hlsDecoded = base64Decode(hlsBase64);
            console.log('HLS Decoded:' + hlsDecoded);
            return hlsDecoded;
        }

        return firstVideo.href;
    } catch (error) {
        console.log('ExtractStreamUrl error:' + error);
        return JSON.stringify([{ provider: 'Error1', link: '' }]);
    }
}



////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions       ////////////////////////////
////////////////////////////      for ExtractEpisodes     ////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

// Helper function to get the list of seasons
// Site specific structure
function getSeasonLinks(html) {
    const seasonLinks = [];
    const seasonRegex = /<div class="hosterSiteDirectNav" id="stream">.*?<ul>(.*?)<\/ul>/s;
    const seasonMatch = seasonRegex.exec(html);
    if (seasonMatch) {
        const seasonList = seasonMatch[1];
        const seasonLinkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        let seasonLinkMatch;
        const filmeLinks = [];
        while ((seasonLinkMatch = seasonLinkRegex.exec(seasonList)) !== null) {
            const [_, seasonLink] = seasonLinkMatch;
            if (seasonLink.endsWith('/filme')) {
                filmeLinks.push(seasonLink);
            } else {
                seasonLinks.push(seasonLink);
            }
        }
        seasonLinks.push(...filmeLinks);
    }
    return seasonLinks;
}

// Helper function to fetch episodes for a season
// Site specific structure
async function fetchSeasonEpisodes(url) {
    try {
        const baseUrl = 'https://aniworld.to';
        const fetchUrl = `${url}`;
        const response = await soraFetch(fetchUrl);
        const text = typeof response === 'object' ? await response.text() : await response;

        // Updated regex to allow empty <strong> content
        const regex = /<td class="seasonEpisodeTitle">\s*<a[^>]*href="([^"]+)"[^>]*>.*?<strong>([^<]*)<\/strong>.*?<span>([^<]+)<\/span>.*?<\/a>/g;

        const matches = [];
        let match;
        let holderNumber = 0;

        while ((match = regex.exec(text)) !== null) {
            const [_, link] = match;
            matches.push({ number: holderNumber, href: `${baseUrl}${link}` });
        }

        return matches;

    } catch (error) {
        console.log('FetchSeasonEpisodes helper function error:' + error);
        return [{ number: '0', href: 'https://error.org' }];
    }
}


////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions       ////////////////////////
////////////////////////////      for ExtractStreamUrl    ////////////////////////
/////////////////////////////////////////////////////////////////////////////////

// Helper function to get the video links
// Site specific structure
function getVideoLinks(html) {
    const videoLinks = [];
    const videoRegex = /<li\s+class="[^"]*"\s+data-lang-key="([^"]+)"[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>.*?<h4>([^<]+)<\/h4>.*?<\/a>.*?<\/li>/gs;
    let match;

    while ((match = videoRegex.exec(html)) !== null) {
        const [_, langKey, href, provider] = match;
        videoLinks.push({ langKey, href, provider });
    }

    return videoLinks;
}

// Helper function to get the available languages
// Site specific structure
function getAvailableLanguages(html) {
    const languages = [];
    const languageRegex = /<img[^>]*data-lang-key="([^"]+)"[^>]*title="([^"]+)"[^>]*>/g;
    let match;

    while ((match = languageRegex.exec(html)) !== null) {
        const [_, langKey, title] = match;
        languages.push({ langKey, title });
    }

    return languages;
}

// Helper function to fetch the base64 encoded string
function base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';

    str = String(str).replace(/=+$/, '');

    if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}


////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions       ////////////////////////
////////////////////////////          from Shade          ////////////////////////
/////////////////////////////////////////////////////////////////////////////////

/**
 * Extracts a JSON object from the given source page by finding the
 * encoded string marked with the regex /MKGMa="([\s\S]+?)"/ and
 * decoding it using the voeDecoder function.
 * @param {string} sourcePageHtml - The source page to be parsed.
 * @returns {object|null} The extracted JSON object if successful,
 *   otherwise null.
 */
function voeExtractor(sourcePageHtml) {
    const REGEX = /MKGMa="([\s\S]+?)"/;

    const match = sourcePageHtml.match(REGEX);
    if(match == null || match[1] == null) {
        console.log('Could not extract from Voe source');
        return null;
    }

    const encodedString = match[1];
    const decodedJson = voeDecoder(encodedString);
    
    return decodedJson;
}

/**
 * Decodes the given MKGMa string, which is a custom encoded string used
 * by VOE. This function applies the following steps to the input string to
 * decode it:
 * 1. Apply ROT13 to each alphabetical character in the string.
 * 2. Remove all underscores from the string.
 * 3. Decode the string using the Base64 algorithm.
 * 4. Apply a character shift of 0x3 to each character in the decoded string.
 * 5. Reverse the order of the characters in the shifted string.
 * 6. Decode the reversed string using the Base64 algorithm again.
 * 7. Parse the decoded string as JSON.
 * @param {string} MKGMa_String - The input string to be decoded.
 * @returns {object} The decoded JSON object.
 */
function voeDecoder(MKGMa_String) {
    let ROT13String = ROT13(MKGMa_String);
    let sanitizedString = voeSanitizer(ROT13String);
    let UnderscoreRemoved = sanitizedString.split('_').join('');
    let base64DecodedString = atob(UnderscoreRemoved);
    let charShiftedString = shiftCharacter(base64DecodedString, 0x3);
    let reversedString = charShiftedString.split('').reverse().join('');
    let base64DecodedStringAgain = atob(reversedString);
    let decodedJson;
    try {
        decodedJson = JSON.parse(base64DecodedStringAgain);
    } catch (error) {
        console.log("JSON parse error:", error);
        decodedJson = {};
    }
    return decodedJson;
}

/**
 * Encodes a given string using the ROT13 cipher, which shifts each letter
 * 13 places forward in the alphabet. Only alphabetical characters are 
 * transformed; other characters remain unchanged.
 * 
 * @param {string} string - The input string to be encoded.
 * @returns {string} The encoded string with ROT13 applied.
 */
function ROT13(string) {
    let ROT13String = '';

    for (let i=0; i < string.length; i++) {
        let currentCharCode = string.charCodeAt(i);

        // Check for uppercase
        if (currentCharCode >= 65 && currentCharCode <= 90) {
            currentCharCode = (currentCharCode - 65 + 13) % 26 + 65;
        // Check for lowercase
        } else if (currentCharCode >= 97 && currentCharCode <= 122) {
            currentCharCode = (currentCharCode - 97 + 13) % 26 + 97;
        }

        ROT13String += String.fromCharCode(currentCharCode);
    }

    return ROT13String;
}

/**
 * Sanitizes a given string by replacing all occurrences of certain "trash" strings
 * with an underscore. The trash strings are '@$', '^^', '~@', '%?', '*~', '!!', '#&'.
 * This is used to decode VOE encoded strings.
 * @param {string} string The string to be sanitized.
 * @returns {string} The sanitized string.
 */
function voeSanitizer(string) {
    let sanitizationArray = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
    let tempString = string;

    for (let i=0; i < sanitizationArray.length; i++) {
        let currentTrash = sanitizationArray[i];
        let sanitizedString = new RegExp(currentTrash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), 'g');

        tempString = tempString.replace(sanitizedString, '_');
    }

    return tempString;
}

/**
 * Shifts the characters in a string by a given number of places.
 * @param {string} string - The string to shift.
 * @param {number} shiftNum - The number of places to shift the string.
 * @returns {string} The shifted string.
 */
function shiftCharacter(string, shiftNum) {
    let tempArray = [];

    for (let i=0; i < string.length; i++) {
        tempArray.push(String.fromCharCode(string.charCodeAt(i) - shiftNum));
    }
    
    return tempArray.join('');
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
    }
}