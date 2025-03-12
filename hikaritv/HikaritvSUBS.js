function searchResults(html) {
    // Cut down on regex-workload
    const trimmedHtml = trimHtml(html, 'class="film_list-wrap', 'class="pre-pagination');

    const regex = /<div class="flw-item"[\s\S]*?src="(.+)"[\s\S]*?href="([^"]+)[\s\S]*?dynamic-name">[\s]*([^<]+)/g;
    const results = Array.from(trimmedHtml.matchAll(regex), match => {
        return { image: match[1], href: match[2], title: match[3].trim() }
    }) || [];

    return JSON.stringify(results);
}

function extractDetails(html) {
    // Cut down on regex-workload
    const trimmedHtml = trimHtml(html, 'class="anisc-info-wrap', '<script');


    const details = {
        description: '',
        aliases: '',
        airdate: ''
    }

    const descriptionRegex = /<h3>Description:<\/h3>[\s\n]*<p>([^<]+)/;
    const descriptionMatch = trimmedHtml.match(descriptionRegex);

    if (descriptionMatch != null) {
        details.description = descriptionMatch[1];
    }

    const sidebarRegex = /(Japanese|English|Synonyms|Aired):<\/span>[\s\n]*<span class="name">([^<]+)/g;
    const sidebarMatch = Array.from(trimmedHtml.matchAll(sidebarRegex), m => {
        let obj = {};
        obj[m[1]] = m[2];
        return obj;
    }) || [];

    if (sidebarMatch.length <= 0) {
        return JSON.stringify([details]);
    }

    const result = Object.assign({}, ...sidebarMatch);

    details.airdate = result?.Aired || '';
    details.aliases = buildAliasString(result);

    return JSON.stringify([details]);

    // Encapsulating this away
    function buildAliasString(resultObj) {
        let string = '';

        if (resultObj?.Japanese) {
            string += resultObj.Japanese;
        }

        if (resultObj?.English) {
            if (string != '') string += ', ';
            string += resultObj.English;
        }

        if (resultObj?.Synonyms) {
            if (string != '') string += ', ';
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

    const regex = /SUB: ([0-9]+)[\s\S]*<a href="\/([^"]+)/;
    const match = trimmedHtml.match(regex);

    if (match == null) {
        return JSON.stringify(episodes);
    }

    episodesBaseUrl = baseUrl + match[2].slice(0, -1);

    for (let i = 1, len = match[1]; i <= len; i++) {
        let episodeUrl = episodesBaseUrl + i;

        episodes.push({
            href: episodeUrl,
            number: i
        });
    }

    return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
    try {
        const regex = /src="([^"]*)/;

        const urlArr = url.split('&');
        const uid = urlArr[1].split('=')[1];
        const episode = urlArr[2].split('=')[1];

        const embedServerUrl = `https://watch.hikaritv.xyz/ajax/embedserver/${uid}/${episode}`;

        const embedServerResponse = await fetch(embedServerUrl);
        const embedServerData = await JSON.parse(embedServerResponse);

        const embedId = embedServerData.embedFirst;
        const embedUrl = `https://watch.hikaritv.xyz/ajax/embed/${uid}/${episode}/${embedId}`;

        const embedResponse = await fetch(embedUrl);
        const embedData = await JSON.parse(embedResponse);

        const iframeString = embedData[0];
        const match = iframeString.match(regex);

        if (match == null) {
            return null;
        }

        const streamUrl = match[1];
        return streamUrl;

    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

function trimHtml(html, startString, endString) {
    const startIndex = html.indexOf(startString);
    const endIndex = html.indexOf(endString, startIndex);
    return html.substring(startIndex, endIndex);
}