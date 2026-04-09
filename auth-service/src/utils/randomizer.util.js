export default class Randomizer {
    // Random username generator in additional cases     Example outputs: "LuckyWolf4821", "SilentTrader9023"
    static generateRandomUsername() {
        const adjectives = ["Swift", "Silent", "Crypto", "Mighty", "Lucky", "Hidden"];
        const nouns = ["Whale", "Tiger", "Phoenix", "Wolf", "Trader", "Ninja"];

        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(1000 + Math.random() * 9000); // 4-digit number

        return `${adj}${noun}${number}`;
    }

}