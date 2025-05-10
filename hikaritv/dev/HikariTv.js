// // //***** LOCAL TESTING
// (async () => {
//     const results = await searchResults('Beyblade X');
//     // console.log('RESULTS:', results);
//     const details = await extractDetails(JSON.parse(results)[0].href);
//     // console.log('DETAILS:', details);
//     const eps = await extractEpisodes(JSON.parse(results)[0].href);
//     // console.log('EPISODES:', JSON.parse(eps));
//     const streamUrl = await extractStreamUrl(JSON.parse(eps)[78].href);
//     console.log('STREAMURL:', streamUrl);
// })();
//***** LOCAL TESTING

async function searchResults(keyword) {
    console.log("================ WTF IS 'THIS' in search ================");
    console.log(JSON.stringify(this));
    console.log("================ WTF IS 'THIS' in search ================");
    const searchUrl = "https://api.hikari.gg/api/anime/?sort=created_at&order=asc&page=1&search=";

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await soraFetch(searchUrl + encodedKeyword);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        const jsonResults = json.results || [];

        // uid = Hikari internal slug
        if(jsonResults.length <= 0) throw("No results found");
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

async function extractDetails(slug) {
    console.log("================ WTF IS 'THIS' in details ================");
    console.log(JSON.stringify(this));
    console.log("================ WTF IS 'THIS' in details ================");
    const detailsUrl = "https://api.hikari.gg/api/anime/uid/";

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
    console.log("================ WTF IS 'THIS' in episodes ================");
    console.log(JSON.stringify(this));
    console.log("================ WTF IS 'THIS' in episodes ================");
    const episodesUrl = "https://api.hikari.gg/api/episode/uid/";
    const embedUrl = "https://api.hikari.gg/api/embed/";

    try {
        const response = await soraFetch(episodesUrl + slug);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        const episodes = json.map(ep => {
            return {
                href: embedUrl + slug + ep.ep_id_name,
                number: parseInt(ep.ep_id_name),
                title: ep.ep_name,
            }
        });

        return JSON.stringify(episodes);        
    } catch (error) {
        console.error('soraFetch error: ' + error.message);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    console.log("================ WTF IS 'THIS' in stream ================");
    console.log(JSON.stringify(this));
    console.log("================ WTF IS 'THIS' in stream ================");
    const typeMap = { 'SOFTSUB': 2, 'DUB': 3, 'MULTI': 4, 'HARDSUB': 8 };
    const moduleTypes = ['SOFTSUB', 'HARDSUB'];
    // const acceptabledProviders = ['Streamwish', 'Hiki']; // TODO - Make Hiki work in Sora, probably baseUrl issue
    const acceptabledProviders = ['Streamwish'];

    try {
        const response = await soraFetch(url);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);

        const acceptableStreams = json.filter(stream => {
            if(!acceptabledProviders.includes(stream.embed_name)) {
                return false;
            }

            for(let moduleType of moduleTypes) {
                if(stream.embed_type == typeMap[moduleType]) {
                    return true;
                }
            }

            return false;
        });

        if(acceptableStreams.length <= 0) throw('No valid streams found');
        console.log('Acceptable streams:', acceptableStreams);

        let streamPromises = [];

        for(let entry of acceptableStreams) {
            if(entry.embed_name == 'Streamwish') {
                let streamOption = extractStreamwish(entry);
                streamPromises.push(streamOption);
                // if(streamOption != null) streamOptions.push(streamOption);
            }
            if(entry.embed_name == 'Hiki') {
                let streamOption = extractHiki(entry);
                streamPromises.push(streamOption);
                // if(streamOption != null) streamOptions.push(streamOption);
            }
        }

        return Promise.allSettled(streamPromises).then((results) => {
            // TODO - Multi-source at some point, but Sora is not willing to work with me

            let streamOptions = []; // v1 (Ideal) // v3 (Less than ideal)
            // let streams = []; // temp for testing // v2 (Sucks)
            // let subtitles = null; // temp for testing // v2 (Sucks)
            // let streamOptions = { stream: null, subtitles: null }; // v3 (Less than ideal)

            for(let result of results) {
                if(result.status === 'fulfilled') {
                    streamOptions.push(result.value); // (Ideal) // (Less than ideal same solution)

                    /* (Sucks)
                    // if(result.value.subtitles == null) {
                    //     streams.push('Hardsub');
                    // } else {
                    //     streams.push('Softsub');
                    // }
                    
                    // streams.push(result.value.stream);
                    
                    // if(result.value.subtitles != null) {
                    //     subtitles = result.value.subtitles;
                    // }
                    */
                }
            }
            if(streamOptions.length <= 0) throw('No valid streams found'); // (Ideal) // (Less than ideal same solution)

            let hardsub = streamOptions.find(s => s.type == 'HARD');
            if(hardsub != null) return JSON.stringify({ stream: hardsub.stream, subtitles: null });

            let softsub = streamOptions.find(s => s.type == 'SOFT');
            if(softsub != null) return JSON.stringify({ stream: softsub.stream, subtitles: softsub.subtitles });

            throw("No hard or softsubs found");

            // return JSON.stringify(streamOptions); // (Ideal)
            // return JSON.stringify({ streams: streams, subtitles: subtitles }); // (Sucks)
            // return JSON.stringify(stream); // (Less than ideal)

        }).catch(error => {
            console.error('Stream promise handler error: ' + error.message);
            return JSON.stringify({ stream: null, subtitles: null });
        });

    } catch(error) {
        console.error('soraFetch error: ' + error.message);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

async function extractHiki(streamData) {
    const proxyUrl = 'https://hikari.gg/hiki-proxy/extract/';
    
    try {
        const frameUrl = streamData.embed_frame;
        let frameSlug = frameUrl.split('/')[3];

        const response = await soraFetch(proxyUrl + frameSlug);
        const json = typeof response === 'object' ? await response.json() : await JSON.parse(response);
        
        if(json.error != null) throw(json.error);
        if(json.url == null) throw('No stream found for Hiki');

        return { stream: json.url, subtitles: null, type: 'HARD' };

    } catch (error) {
        console.error('Failed to extract Hiki: ' + error.message);
        return null;
    }
}

async function extractStreamwish(streamData) {
    try {
        const frameUrl = streamData.embed_frame;

        const streamResponse = await soraFetch(frameUrl);
        const streamHtml = await streamResponse.text();

        if(streamData.embed_name == 'Streamwish') {
            const streamwishRegex = /links=({[\s\S]+?})/;
            const streamwishCaptionsRegex = /tracks:([\s\S]+?])/;

            const streamwishPackerRegex = /<script type='text\/javascript'>(eval\(function\(p,a,c,k,e,d\)[\s\S]+?)<\/script>/;
            const streamwishPacker = streamHtml.match(streamwishPackerRegex);
            const streamwishUnpacked = unpack(streamwishPacker[1]);

            const files = streamwishUnpacked.match(streamwishRegex);
            if(!files[1]) {
                throw('No streams found');
            }

            let subtitles = null;
            let type = 'HARD';

            const tracks = streamwishUnpacked.match(streamwishCaptionsRegex);
            if(tracks[1]) {
                let validJsonString = tracks[1].replaceAll('file:', '"file":').replaceAll('label:', '"label":').replaceAll('kind:', '"kind":');
                let tracksJson = JSON.parse(validJsonString);

                const englishSubs = tracksJson.filter(track => track.label == 'English' && track.kind == 'captions');
                
                if(englishSubs.length > 0) {
                    subtitles = englishSubs[0].file;
                    type = 'SOFT';
                }
            }

            const filesJson = JSON.parse(files[1]);
            
            if(filesJson.hls2) {
                return { stream: filesJson.hls2, subtitles: subtitles, type: type };
            } else if(filesJson.hls4) {
                return { stream: filesJson.hls4, subtitles: subtitles, type: type };
            } else {
                throw('No streams found');
            }
        }
    } catch(error) {
        console.error('Failed to extract Streamwish: ' + error.message);
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