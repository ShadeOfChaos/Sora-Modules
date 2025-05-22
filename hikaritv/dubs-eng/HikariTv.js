async function areRequiredServersUp() {
    const requiredHosts = ['https://hikari.gg'];

    try {
        let promises = [];

        for(let host of requiredHosts) {
            promises.push(
                new Promise(async (resolve) => {
                    let response = await soraFetch(host, { method: 'HEAD' });
                    response.host = host;
                    return resolve(response);
                })
            );
        }

        return Promise.allSettled(promises).then((responses) => {
            for(let response of responses) {
                if(response.status === 'rejected' || response.value?.status != 200) {
                    let message = 'Required source ' + response.value?.host + ' is currently down.';
                    console.log(message);
                    return { success: false, error: encodeURIComponent(message), searchTitle: `Error cannot access ${ response.value?.host }, server down. Please try again later.` };
                }
            }

            return { success: true, error: null, searchTitle: null };
        })

    } catch (error) {
        console.log('Server up check error: ' + error.message);
        return { success: false, error: encodeURIComponent('#Failed to access required servers'), searchTitle: 'Error cannot access one or more servers, server down. Please try again later.' };
    }
}

async function searchResults(keyword) {
    const searchUrl = "https://api.hikari.gg/api/anime/?sort=created_at&order=asc&page=1&search=";
    const serversUp = await areRequiredServersUp();

    if(serversUp.success === false) {
        return JSON.stringify([{
            title: serversUp.searchTitle,
            image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
            href: '#' + serversUp.error,
        }]);
    }

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await soraFetch(searchUrl + encodedKeyword);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        let jsonResults = json.results || [];

        // uid = Hikari internal slug
        if(jsonResults.length <= 0) throw new Error('No results found');

        if(json.next != null) {
            const followupResults = await getFollowupSearches(json);
            jsonResults = jsonResults.concat(followupResults);
        }

        const results = jsonResults.map(result => {
            return {
                title: result.ani_name,
                image: result.ani_poster,
                href: result.uid + '/',
            };
        });

        return JSON.stringify(results);
    } catch (error) {
        console.log('soraFetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

async function getFollowupSearches(json) {
    const searchUrl = json.next;
    const pages = Math.floor(json.count / json.results.length);

    const p = [];

    // Pages + 1 since the first page has already been fetched
    for(let i = 2; i <= pages + 1; i++) {
        p.push(
            new Promise(async (resolve) => {
                let url = searchUrl.replace('page=2', 'page=' + i);

                try {
                    const response = await soraFetch(url);
                    const responseJson = typeof response === 'object' ? await response.json() : await JSON.parse(response);

                    return resolve(responseJson.results);

                } catch(error) {
                    console.error(error);
                    return resolve([]);
                }
            })
        );
    }

    return Promise.allSettled(p).then((results) => {
        let mergedResults = [];

        for(let result of results) {
            if(result.status === 'fulfilled') {
                mergedResults = mergedResults.concat(result.value);
            }
        }

        return mergedResults;
    });
}

async function extractDetails(slug) {
    const detailsUrl = "https://api.hikari.gg/api/anime/uid/";

    if(slug.startsWith('#')) {
        return JSON.stringify([{
            description: decodeURIComponent(slug.slice(1)) + ' Please try again later.',
            aliases: '',
            airdate: ''
        }]);
    }

    try {
        const response = await soraFetch(detailsUrl + slug);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        const details = {
            description: '',
            aliases: '',
            airdate: ''
        }

        let airDate = '';
        if(json?.ani_aired) {
            if(json?.ani_aired_fin) {
                airDate = `${ json.ani_aired } - ${ json.ani_aired_fin }`;
            } else {
                airDate = json.ani_aired;
            }
        } else {
            if(json?.ani_release) {
                airDate = json.ani_release;
            } else {
                airDate = 'Aired: Unknown';
            }
        }

        details.description = json.ani_synopsis ?? 'No description available';
        details.aliases = json.ani_synonyms ?? '';
        details.airdate = airDate;

        return JSON.stringify([details]);

    } catch (error) {
        console.log('Details error: '  + error.message);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: '',
            airdate: 'Aired: Unknown'
        }]);
    }
}

async function extractEpisodes(slug) {
    const episodesUrl = "https://api.hikari.gg/api/episode/uid/";
    const embedUrl = "https://api.hikari.gg/api/embed/";

    try {
        if(slug.startsWith('#')) throw new Error('Host down but still attempted to get episodes');

        const response = await soraFetch(episodesUrl + slug);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        const episodes = json.map(ep => {
            return {
                href: embedUrl + slug + ep.ep_id_name,
                number: parseInt(ep.ep_id_name),
                title: ep.ep_name,
            }
        }).sort((a, b) => a.number - b.number);

        return JSON.stringify(episodes);        
    } catch (error) {
        console.log('soraFetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    const typeMap = { 'SOFTSUB': 2, 'DUB': 3, 'MULTI': 4, 'HARDSUB': 8 };
    const moduleType = 'DUB';
    const acceptabledProviders = ['Streamwish'];

    try {
        const response = await soraFetch(url);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        const acceptableStreams = json.filter(stream => acceptabledProviders.includes(stream.embed_name) && stream.embed_type == typeMap[moduleType]);
        if(acceptableStreams.length <= 0) throw new Error('No valid streams found');
        
        const frameUrl = acceptableStreams[0].embed_frame;

        const streamResponse = await soraFetch(frameUrl);
        const streamHtml = await streamResponse.text();

        let streamUrl = '';

        if(acceptableStreams[0].embed_name == 'Streamwish') {
            const streamwishRegex = /links=({[\s\S]+?})/;

            const streamwishPackerRegex = /<script type='text\/javascript'>(eval\(function\(p,a,c,k,e,d\)[\s\S]+?)<\/script>/;
            const streamwishPacker = streamHtml.match(streamwishPackerRegex);
            const streamwishUnpacked = unpack(streamwishPacker[1]);
            

            const files = streamwishUnpacked.match(streamwishRegex);
            if(!files[1]) {
                throw new Error('No streams found');
            }

            const filesJson = JSON.parse(files[1]);
            
            if(filesJson.hls2) {
                return filesJson.hls2;
            } else if(filesJson.hls4) {
                return filesJson.hls4;
            } else {
                throw new Error('No streams found');
            }
        }

        return streamUrl;

    } catch(error) {
        console.log('Failed to extract StreamUrl: ' + error.message);
        return null;
    }
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

// Adjusted from js-beautify (https://github.com/beautifier/js-beautify/blob/03e3cc02949b42970ab12c2bfbfb33c7bced8eba/js/src/unpackers/p_a_c_k_e_r_unpacker.js)
function detect(str) {
    return (get_chunks(str).length > 0);
}

function get_chunks(str) {
    var chunks = str.match(/eval\(\(?function\(.*?(,0,\{\}\)\)|split\('\|'\)\)\))($|\n)/g);
    return chunks ? chunks : [];
}

function unpack(str) {
    var chunks = get_chunks(str),
    chunk;
    for (var i = 0; i < chunks.length; i++) {
    chunk = chunks[i].replace(/\n$/, '');
    str = str.split(chunk).join(unpack_chunk(chunk));
    }
    return str;
}

function unpack_chunk(str) {
    var unpacked_source = '';
    var __eval = eval;
    if (detect(str)) {
    try {
        eval = function (s) {
        unpacked_source += s;
        return unpacked_source;
        };
        __eval(str);
        if (typeof unpacked_source === 'string' && unpacked_source) {
        str = unpacked_source;
        }
    } catch (e) {
        // well, it failed. we'll just return the original, instead of crashing on user.
    }
    }
    eval = __eval;
    return str;
}