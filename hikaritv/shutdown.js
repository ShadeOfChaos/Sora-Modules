async function searchResults(keyword) {
    const name = 'Hikari';

    return JSON.stringify([{
        title: name + ' has shut down',
        image: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
        href: ''
    }]);
}

async function extractDetails(url) {
    const baseUrl = 'https://hikari.gg';

    return JSON.stringify([{
        description: baseUrl + ' has shut down, the module is therefore no longer functional and will also be shut down.',
        aliases: '',
        airdate: ''
    }]);
}

async function extractEpisodes(url) {
    return JSON.stringify([]);
}

async function extractStreamUrl(url) {
    return null;
}