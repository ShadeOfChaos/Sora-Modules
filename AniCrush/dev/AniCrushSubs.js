//***** LOCAL TESTING
// const results = await searchResults('Solo Leveling');
// console.log(results);
// const details = await extractDetails(JSON.parse(results)[0].href);
// console.log('DETAILS:', details);
// const episodes = await extractEpisodes(JSON.parse(results)[0].href);
// console.log('OUTSIDE EPISODES:', episodes);
// const streamUrl = await extractStreamUrl(JSON.parse(episodes)[0].href);
// console.log('STREAMURL:', streamUrl);
//***** LOCAL TESTING

/**
 * Given an image path, returns the URL to the resized image on AniCrush's CDN.
 * @param {string} path - The image path to transform.
 * @param {string} [type="poster"] - The type of image requested (poster or banner).
 * @returns {string} - The URL to the resized image.
 */
function getImage(path, type = "poster") {
    const SOURCE_STATIC_URL = "https://static.gniyonna.com/media/poster";
    const pathToReverse = path.split('/')[2];

    let reversedPath = '';
    for (let i = pathToReverse.length - 1; i >= 0; i--) {
        reversedPath += pathToReverse[i];
    }

    const extension = path.split('.').pop();
    const imageUrl = `${ SOURCE_STATIC_URL }/${type === "poster" ? "300x400" : "900x600"}/100/${ reversedPath }.${ extension }`;

    return imageUrl;
}

/**
 * Searches the website for anime with the given keyword and returns the results
 * @param {string} keyword The keyword to search for
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
 */
async function searchResults(keyword) {
    const BASE_URL = 'https://anicrush.to';
    const UTILITY_URL = 'https://ac-api.ofchaos.com';
    
    try {
        const page = 1;
        const limit = 24;
        const response = await fetch(`${ UTILITY_URL }/api/anime/search?keyword=${encodeURIComponent(keyword)}&page=${ page }&limit=${ limit }`);
        const data = await response.json();

        if(data?.status == false || data?.result?.movies?.length <= 0) {
            throw('No results found');
        }

        const results = data.result.movies.map(movie => {
            const href = `${ BASE_URL }/watch/${ movie.slug }.${ movie.id }`;

            return { title: movie.name, image: getImage(movie.poster_path), href: href }
        });

        return JSON.stringify(results);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

/**
 * Extracts the details (description, aliases, airdate) from the given url
 * @param {string} url The id required to fetch the details
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
 */
async function extractDetails(url) {
    const UTILITY_URL = "https://ac-api.ofchaos.com";
    const movieId = url.split('.').pop();

    try {
        const response = await fetch(`${ UTILITY_URL }/api/anime/info/${ movieId }`);
        const data = await response.json();

        if(data?.status == false || data?.result == null) {
            throw('No results found');
        }

        const details = {
            description: data.result?.overview,
            aliases: buildAliasString(data.result),
            airdate: data.result?.aired_from + ' - ' + data.result?.aired_to
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

    // Encapsulating this away
    function buildAliasString(resultObj) {
        let string = '';

        if (resultObj?.name) {
            string += resultObj.name;
        }

        if (resultObj?.name_english) {
            
            if (string != '') string += ', ';
            string += resultObj.name_english;
        }

        if (resultObj?.name_japanese) {
            if (string != '') string += ', ';
            string += resultObj.name_japanese;
        }

        if (resultObj?.name_synonyms) {
            if (string != '') string += ', ';
            string += resultObj.name_synonyms;
        }

        return string;
    }
}

/**
 * Extracts the episodes from the given url.
 * @param {string} url - The id required to fetch the episodes
 * @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
 * If an error occurs during the fetch operation, an empty array is returned in JSON format.
 */
async function extractEpisodes(url) {
    const SOURCE_API_URL = "https://api.anicrush.to";
    const UTILITY_URL = "https://ac-api.ofchaos.com";
    const movieId = url.split('.').pop();

    try {
        const serverId = 4;
        const format = 'sub';
        var episodes = [];

        const response = await fetch(`${ UTILITY_URL }/api/anime/episodes?movieId=${ movieId }`);
        const data = await response.json();

        if(data?.status == false || data?.result == null) {
            throw('No results found');
        }
        
        for(let episodeList in data.result) {
            for(let episode of data.result[episodeList]) {
                episodes.push({
                    href: `${ SOURCE_API_URL }/shared/v2/episode/sources?_movieId=${ movieId }&ep=${ episode.number }&sv=${ serverId }&sc=${ format }`,
                    number: episode.number
                });
            }
        }

        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([]);
    }
}

/**
 * Extracts the stream URL from the given url, using a utility function on ac-api.ofchaos.com.
 * @param {string} url - The url to extract the stream URL from.
 * @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
 */
async function extractStreamUrl(url) {
    const SOURCE_BASE_URL = "https://anicrush.to";
    const UTILITY_URL = "https://ac-api.ofchaos.com";

    try {
        if(url.indexOf('?') <= 0) {
            throw('Invalid url provided');
        }

        const paramString = url.split('?')[1];
        const params = paramString.split('&');
        let id = '';
        let episode = 1;
        let server = 4;
        let format = 'sub';

        for(let paramStr of params) {
            let param = paramStr.split('=');
            switch(param[0]) {
                case '_movieId':
                    id = param[1];
                    break;
                case 'ep':
                    episode = param[1];
                    break;
                case 'sv':
                    server = param[1];
                    break;
                case 'sc':
                    format = param[1];
                    break;
            }
        }

        if(id == '') {
            throw('Invalid _movieId provided');
        }

        const serversResponse = await fetch(`${ UTILITY_URL }/api/anime/servers/${ id }?episode=${ episode }`);
        const serversData = await serversResponse.json();

        if(serversData.status == false || serversData.result == null) {
            throw('No servers found');
        }

        if (
            serversData?.status !== true  ||
            serversData?.result == null ||
            serversData.result[format] == null ||
            serversData.result[format].length <= 0
        ) {
            throw('No server found');
        }

        const serverObjects = serversData.result[format];
        const serverObject = serverObjects.find(s => s.server == server);

        if(serverObject != null) {
            server = serverObject.server;
        } else {
            serverObject = serverObjects[0].server;
        }

        const sourceResponse = await fetch(`${ UTILITY_URL }/api/anime/sources?movieId=${ id }&episode=${ episode }&server=${ server }&format=${ format }`);
        const sourceData = await sourceResponse.json();

        if(
            sourceData.status == false || 
            sourceData.result == null || 
            sourceData.result.link == "" ||
            sourceData.result.link == null
        ) {
            throw('No source found');
        }

        const source = sourceData.result.link;

        // Older version which might or might not work, new method incorporates getting the embed from the source
        // const hlsUrl = `${ UTILITY_URL }/api/anime/hls/${ id }?episode=${ episode }&server=${ server }&format=${ format }`;
        // const hlsResponse = await fetch(hlsUrl);
        // const hlsData = await hlsResponse.json();

        const hlsUrl = `${ UTILITY_URL }/api/anime/embed/convert?embedUrl=${ encodeURIComponent(source) }&host=${ encodeURIComponent(SOURCE_BASE_URL) }`;
        const hlsResponse = await fetch(hlsUrl);
        const hlsData = await hlsResponse.json();

        if(hlsData?.status == false || hlsData?.result == null || hlsData?.error != null) {
            throw('No stream found');
        }

        if(hlsData.result?.sources?.length <= 0) {
            throw('No source found');
        }

        let hlsSource = null;

        for(let source of hlsData.result.sources) {
            if(source.type === 'hls') {
                hlsSource = source;
                break;
            }
        }

        if(hlsSource == null) {
            throw('No valid HLS stream found');
        }

        if(hlsData.result?.tracks?.length <= 0) {
            throw('No valid substitles found');
        }

        let reserveSubtitles = null;
        let subtitles = null;

        for(let track of hlsData.result.tracks) {
            if(track.kind === 'captions') {
                if(track?.label !== 'English') {
                    continue;
                }
                if(track?.default === true) {
                    subtitles = track;
                    break;
                }
                reserveSubtitles = track;
            }
        }

        if(subtitles == null) {
            if(reserveSubtitles == null) {
                throw('No valid subtitles found');
            }

            subtitles = reserveSubtitles;
        }

        const streamUrl = {
            stream: hlsSource ? hlsSource.file : null,
            subtitles: subtitles ? subtitles.file : null
        };

        return JSON.stringify(streamUrl);

    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}
