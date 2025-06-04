(async() => {
    const results = await searchResults('Once Upon a Witch');
    console.log('SEARCH RESULTS: ', results);
    const details = await extractDetails(JSON.parse(results)[0].href);
    console.log('DETAILS: ', details);
    const episodes = await extractEpisodes(JSON.parse(results)[0].href);
    console.log('EPISODES: ', episodes);
    const streamUrl = await extractStreamUrl(JSON.parse(episodes)[9].href);
    console.log('STREAMURL: ', streamUrl);
})();

async function searchResults(keyword) {
    const results = [];

    const response = await soraFetch(`https://kickassanime.com.es/?s=${encodeURIComponent(keyword)}`);
    const html = await response.text();

    const regex = /<article class="bs"[\s\S]*?<a\s+href="(.*?)"[^>]*?title="(.*?)"[\s\S]*?<img\s+src="(.*?)"[\s\S]*?<h2 itemprop="headline">(.*?)<\/h2>/gi;

    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            title: match[4].trim(),
            image: match[3].trim(),
            href: match[1].trim()
        });
    }

    return JSON.stringify(results);
}


async function extractDetails(url) {
    const results = [];
    const response = await soraFetch(url);
    const html = await response.text();

    const regex = /<div class="entry-content" itemprop="description">([\s\S]*?)<\/div>/;
    const match = html.match(regex);

    let description = "N/A";
    if (match) {
        description = match[1]
            .replace(/<p>/g, '')
            .replace(/<\/p>/g, '\n')
            .replace(/\s*\(Source:.*?\)\s*/g, '') 
            .trim();
    }

    results.push({
        description: description,
        aliases: 'N/A',
        airdate: 'N/A'
    });

    return JSON.stringify(results);
}

async function extractEpisodes(url) {
    const results = [];
    const response = await soraFetch(url);
    const html = await response.text();

    const regex = /<a href="(https:\/\/[^"]+?)">\s*<div class="epl-num">(\d+)<\/div>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        results.push({
            href: match[1].trim(),
            number: parseInt(match[2], 10)
        });
    }

    return JSON.stringify(results.reverse());
}

async function extractStreamUrl(url) {
    const response = await soraFetch(url);
    const html = await response.text();

    const iframeMatch = html.match(/<iframe[^>]+src="([^"]*https?:\/\/megaplay\.buzz\/stream\/[^"]*)"/i);
    if (!iframeMatch) return null;

    const iframeUrl = iframeMatch[1];

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Referer': 'https://kickassanime.com.es/'
    };

    console.log(iframeUrl);
    const streamResponse = await soraFetch(iframeUrl, { headers: headers });
    const streamHtml = await streamResponse.text();
    const idMatch = streamHtml.match(/data-id="(\d+)"/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const finalUrl = `https://megaplay.buzz/stream/getSources?id=${id}&id=${id}`;
    const finalHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'Referer': 'https://kickassanime.com.es/'

    };
    const finalResponse = await soraFetch(finalUrl, { headers: finalHeaders });
    const finalData = await finalResponse.json();

    console.log(JSON.stringify(finalData));

    const streams = finalData.sources?.file ?? null;
    const subtitles = finalData.tracks?.find(track => track.label === "English")?.file ?? null;

    const result = {
        title: "Testing",
        streamUrl: streams,
        headers: { referer: "https://megaplay.buzz/" },
        subtitles: subtitles
    }

    return JSON.stringify(result);
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