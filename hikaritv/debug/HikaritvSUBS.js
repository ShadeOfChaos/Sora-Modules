const fs = require('node:fs');

function searchResults(html) {
    // Cut down on regex-workload
    const trimmedHtml = trimHtml(html, 'class="film_list-wrap', 'class="pre-pagination');
    // const trimmedHtml = trimHtmlToLastString(html, 'class="film_list-wrap', 'class="pre-pagination');

    // Debugging
    writeFile('searchTrimmed.html', trimmedHtml);

    const regex = /<div class="flw-item"[\s\S]*?src="(.+)"[\s\S]*?href="([^"]+)[\s\S]*?dynamic-name">[\s]*([^<]+)/g;

    const results = Array.from(trimmedHtml.matchAll(regex), match => { 
        return { image: match[1], href: match[2], title: match[3].trim() } 
    }) || [];
    
    return results;
}

function extractDetails(html) {
    // Cut down on regex-workload
    const trimmedHtml = trimHtml(html, 'class="anisc-info-wrap', '<script');

    // Debugging
    writeFile('detailsTrimmed.html', trimmedHtml);

    const details = {
        description: '',
        aliases: '',
        airdate: ''
    }
    
    const descriptionRegex = /<h3>Description:<\/h3>[\s\n]*<p>([^<]+)/;
    const descriptionMatch = trimmedHtml.match(descriptionRegex);
    
    if(descriptionMatch != null) {
        details.description = descriptionMatch[1];
    }
    
    const sidebarRegex = /(Japanese|English|Synonyms|Aired):<\/span>[\s\n]*<span class="name">([^<]+)/g;
    const sidebarMatch = Array.from(trimmedHtml.matchAll(sidebarRegex), m => { 
        let obj = {};
        obj[m[1]] = m[2];	
        return obj;
    }) || [];
    
    if(sidebarMatch.length <= 0) {
        return details;
    }
    
    const result = Object.assign({}, ...sidebarMatch);
    
    details.airdate = result?.Aired || '';
    details.aliases = buildAliasString(result);

    return details;

    // Encapsulating this away
    function buildAliasString(resultObj) {
        let string = '';
    
        if(resultObj?.Japanese) {
            string += resultObj.Japanese;
        }
    
        if(resultObj?.English) {
            if(string != '') string += ', ';
            string += resultObj.English;
        }
    
        if(resultObj?.Synonyms) {
            if(string != '') string += ', ';
            string += resultObj.Synonyms;
        }
    
        return string;
    }
}

function extractEpisodes(html) {
    const episodes = [];
    const baseUrl = "https://watch.hikaritv.xyz/";
    let episodesBaseUrl = '';

    // Cut down on regex-workload
    const trimmedHtml = trimHtml(html, 'class="anisc-detail', 'btn-play');

    // Debugging
    writeFile('episodesTrimmed.html', trimmedHtml);

    const regex = /SUB: ([0-9]+)[\s\S]*<a href="\/([^"]+)/;
    const match = trimmedHtml.match(regex);


    if(match == null) {
        return episodes;
    }

    episodesBaseUrl = baseUrl + match[2].slice(0, -1);

    for(let i = 1, len = match[1]; i<=len; i++) {
        episodes.push(episodesBaseUrl + i);
    }

    return episodes;
}

// function extractStreamUrl(html) {
//     // const trimmedHtml = trimHtml(html, 'class="anis-watch-wrap', 'class="film-stats');
//     const trimmedHtml = trimHtml(html, 'id="syncData', '</script>');
    

//     // // Debugging
//     writeFile('streamUrlFull.html', html);
//     writeFile('streamUrlTrimmed.html', trimmedHtml);

//     const idRegex = /href="\/anime\/([^\/]*)/;
//     // const episodeRegex = //;

//     // const idMatch = trimmedHtml.match(idRegex);
//     // const episodeMatch = trimmedHtml.match(episodeRegex);


//     let embedServerUrl = 'https://watch.hikaritv.xyz/ajax/embedserver/%uid%/%ep%';
    


//     // const sourceRegex = /<source[^>]+id="iframevideo"[^>]+src="([^"]+)"/;
//     // const match = html.match(sourceRegex);
//     // return match ? match[1] : null;

//     return null;
// }

async function extractStreamUrl(url) {
    try {
        // https://watch.hikaritv.xyz/watch?anime=Ore_dake_Level_Up_na_Ken&uid=52299&eps=1
        const regex = /src="([^"]*)/;

        const urlArr = url.split('&');
        const uid = urlArr[1].split('=')[1];
        const episode = urlArr[2].split('=')[1];

        const embedServerUrl = `https://watch.hikaritv.xyz/ajax/embedserver/${uid}/${episode}`;

        const embedServerResponse = await fetch(embedServerUrl);
        const embedServerData = await embedServerResponse.json();

        const embedId = embedServerData.embedFirst;
        const embedUrl = `https://watch.hikaritv.xyz/ajax/embed/${uid}/${episode}/${embedId}`;

        const embedResponse = await fetch(embedUrl);
        const embedData = await embedResponse.json();

        const iframeString = embedData[0];
        const match = iframeString.match(regex);
        
        if(match == null) {
            return JSON.stringify({ stream: null, subtitles: null });
        }

        const streamUrl = match[1];

        const result = {
            stream: streamUrl,
            subtitles: null
        };
        return JSON.stringify(result);
    } catch (error) {
        console.error('Fetch error:', error);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}

function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
}


const keyword = "Solo Leveling";
const encodedKeyword = encodeURIComponent(keyword);

fetch(`https://watch.hikaritv.xyz/search?keyword=${encodedKeyword}&language=ani_sub`)
    .then(response => {
        response.text().then(text => {
            // console.log(searchResults(text));
            let searchResult = searchResults(text);
            let detailsUrl = "https://watch.hikaritv.xyz/" + searchResult[0].href;

            // fetch(detailsUrl)
            //     .then(detailsResponse => {
            //         detailsResponse.text().then(detailsText => {
            //             console.log('Details:', extractDetails(detailsText));
            //         });
            //     });

            fetch(detailsUrl)
            .then(detailsResponse => {
                detailsResponse.text().then(detailsText => {
                    // console.log('Episodes:', extractEpisodes(detailsText));

                    let episodeUrls = extractEpisodes(detailsText);
                    extractStreamUrl(episodeUrls[0]).then(streamObj => {
                        console.log('extractStreamUrl:', streamObj);
                    });

                    // fetch(episodeUrls[0])
                    //     .then(streamResponse => {
                    //         streamResponse.text().then(streamText => {
                    //             console.log('Stream URL:', extractStreamUrl(streamText));
                    //         });
                    //     });
                });
            });
        });
    });

// DEBUGGING
function writeFile(title, content) {
    fs.writeFile('hikaritv/' + title, content, err => {
        if (err) {
            console.error(err);
        } else {
            console.log(`Written file ${title} successfully`);
        }
    });
}