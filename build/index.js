"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Packages:
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = __importDefault(require("cheerio"));
const striptags_1 = __importDefault(require("striptags"));
const stopword_1 = __importDefault(require("stopword"));
const kirak32_1 = __importDefault(require("./tools/kirak32"));
const jimp_1 = __importDefault(require("jimp"));
const fs_1 = __importDefault(require("fs"));
const instagram_private_api_1 = require("instagram-private-api");
const lodash_1 = __importDefault(require("lodash"));
;
// Constants:
const links_1 = require("./constants/links");
const credentials_1 = require("./constants/credentials");
const sources_1 = require("./constants/sources");
// Functions:
const knuthShuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]]
            =
                [array[randomIndex], array[currentIndex]];
    }
    return array;
};
const sleep = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    yield new Promise(resolve => setTimeout(resolve, ms));
});
const nthMostCommon = (wordsArray, amount) => {
    const wordOccurrences = {};
    for (let i = 0; i < wordsArray.length; i++) {
        wordOccurrences['_' + wordsArray[i]] = (wordOccurrences['_' + wordsArray[i]] || 0) + 1;
    }
    const result = Object.keys(wordOccurrences).reduce((acc, currentKey) => {
        for (let i = 0; i < amount; i++) {
            if (!acc[i]) {
                acc[i] = { word: currentKey.slice(1, currentKey.length), occurences: wordOccurrences[currentKey] };
                break;
            }
            else if (acc[i].occurences < wordOccurrences[currentKey]) {
                acc.splice(i, 0, { word: currentKey.slice(1, currentKey.length), occurences: wordOccurrences[currentKey] });
                if (acc.length > amount) {
                    acc.pop();
                }
                break;
            }
        }
        return acc;
    }, []);
    return result;
};
const getHashtags = (article) => {
    return nthMostCommon(stopword_1.default.removeStopwords(article.toLocaleLowerCase().split(/\s/)), 15)
        .filter(commonWord => RegExp(/^#?[^\s!@#$%^&*()=+./,\[{\]};:'"?><]+$/g).test(commonWord.word))
        .map(commonWord => `#${commonWord.word}`).join(' ');
};
const fetchOpIndiaArticle = (URL) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    let article = '';
    $('.wpb_column.vc_column_container.tdc-column.td-pb-span8 > .wpb_wrapper')
        .find('.td_block_wrap.tdb_single_content.td-pb-border-top.td_block_template_1.td-post-content.tagdiv-type > .tdb-block-inner.td-fix-index')
        .find('p').each((_i, element) => {
        const paragraph = $(element).html();
        if (paragraph !== null) {
            article = article.concat(`\n${striptags_1.default(paragraph)}`);
        }
    });
    return article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
});
const fetchOpIndiaArticles = ({ URL, articleCount }) => __awaiter(void 0, void 0, void 0, function* () {
    const articles = [];
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    $('.td_block_inner.tdb-block-inner.td-fix-index .tdb_module_loop.td_module_wrap.td-animation-stack').each((i, element) => {
        var _a, _b, _c;
        if (i < articleCount) {
            const headerImageURL = (_a = $(element).find('.td-image-container > .td-module-thumb').find('a > span').attr('data-img-url')) !== null && _a !== void 0 ? _a : '';
            const title = ((_b = $(element).find('.td-image-container > .td-module-thumb').find('a').attr('title')) !== null && _b !== void 0 ? _b : '').replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
            const category = $(element).find('.td-image-container > .td-post-category').text();
            const articleLink = (_c = $(element).find('.td-module-meta-info > .entry-title.td-module-title').find('a').attr('href')) !== null && _c !== void 0 ? _c : '';
            const articleID = articleLink ? kirak32_1.default(articleLink) : '0';
            const author = $(element).find('.td-module-meta-info > .td-editor-date').find('.td-author-date > .td-post-author-name').find('a').text();
            const excerpt = $(element).find('.td-module-meta-info > .td-excerpt').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
            articles.push({
                headerImageURL,
                title,
                category,
                articleLink,
                articleID,
                author: author === 'OpIndia Staff' ? 'External Sources' : author,
                excerpt,
                source: sources_1.OPINDIA,
                caption: ''
            });
        }
    });
    return articles;
});
const fetchTheWireArticle = (URL) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    let article = '';
    $('.grey-text').find('p').each((_i, element) => {
        const paragraph = $(element).html();
        if (paragraph !== null) {
            article = article.concat(`\n${striptags_1.default(paragraph)}`);
        }
    });
    return article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
});
const fetchTheWireArticles = ({ URL, articleCount }) => __awaiter(void 0, void 0, void 0, function* () {
    const articles = [];
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    $('.card__header + .card__content-wrapper').find('div').find('.card.horizontal.card__header--rm-margin.row-height').each((i, element) => {
        var _a, _b, _c;
        if (i < articleCount) {
            const headerImageURL = (_a = $(element).find('.card-image > a > img').attr('src')) !== null && _a !== void 0 ? _a : '';
            const title = (_b = $(element).find('.card-stacked > .card-content > .card__title > a').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`)) !== null && _b !== void 0 ? _b : '';
            const category = $(element).find('.card-stacked > .card-content > a > .tag').text();
            const articleLink = 'https://thewire.in' + ((_c = $(element).find('.card-stacked > .card-content > .card__title > a').attr('href')) !== null && _c !== void 0 ? _c : '');
            const articleID = articleLink ? kirak32_1.default(articleLink) : '0';
            const author = $(element).find('.card-stacked > .card-content > .card__author-name.hide-on-small-only > a').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
            articles.push({
                headerImageURL,
                title,
                category,
                articleLink,
                articleID,
                author: author === 'The Wire Staff' ? 'External Sources' : author,
                excerpt: '',
                source: sources_1.THEWIRE,
                caption: ''
            });
        }
    });
    return articles;
});
const createPost = (headerImageURL, title, excerpt, index) => __awaiter(void 0, void 0, void 0, function* () {
    const image = new jimp_1.default(1000, 1000, '#FFFFFF');
    const headerImage = (yield jimp_1.default.read(headerImageURL)).cover(1000, 500);
    const logo = (yield jimp_1.default.read('./assets/logo/thewiredwatermark.jpg')).resize(125, 50);
    const titleFont = yield jimp_1.default.loadFont('./assets/fonts/josefin-sans-48-black-bold/josefin-sans-48-black-bold.fnt');
    const excerptFont = yield jimp_1.default.loadFont('./assets/fonts/josefin-sans-40-black-light/josefin-sans-40-black-light.fnt');
    let computedHeight = 0;
    // Add header image.
    image.composite(headerImage, 0, 0, {
        mode: jimp_1.default.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
    });
    computedHeight = computedHeight + headerImage.getHeight();
    // Draw left border.
    image.scan(0, 0, 10, 1000, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0xBD000AFF, offset);
    });
    // Add logo.
    image.composite(logo, 10, 0, {
        mode: jimp_1.default.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
    });
    // Print title.
    const titleHeight = jimp_1.default.measureTextHeight(titleFont, title, 1000 - 50 - 50);
    image.print(titleFont, 50, headerImage.getHeight() + 30, title, 1000 - 50 - 50, titleHeight);
    computedHeight = computedHeight + titleHeight + 30;
    // Draw middle border.
    image.scan(0, computedHeight + 20, 1000, 10, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0xBD000AFF, offset);
    });
    computedHeight = computedHeight + 20 + 10;
    // Print excerpt.
    image.print(excerptFont, 50, computedHeight, {
        text: excerpt,
        alignmentX: jimp_1.default.HORIZONTAL_ALIGN_LEFT,
        alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
    }, 1000 - 50 - 50, 1000 - computedHeight);
    image.write(`./assets/output/posts/${index}.jpg`);
    // return await image.getBase64Async(Jimp.MIME_JPEG);
});
const createStory = (headerImageURL, title, index) => __awaiter(void 0, void 0, void 0, function* () {
    const image = new jimp_1.default(1080, 1920, '#000000');
    const headerImage = (yield jimp_1.default.read(headerImageURL)).cover(1080, 960);
    const logo = (yield jimp_1.default.read('./assets/logo/thewiredstorywatermark.jpg')).resize(175, 75);
    const titleFont = yield jimp_1.default.loadFont('./assets/fonts/josefin-sans-96-white-bold/josefin-sans-96-white-bold.fnt');
    const smallTitleFont = yield jimp_1.default.loadFont('./assets/fonts/josefin-sans-64-white-bold/josefin-sans-64-white-bold.fnt');
    let computedHeight = 0;
    // Add header image.
    image.composite(headerImage, 0, 0, {
        mode: jimp_1.default.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
    });
    computedHeight = computedHeight + 960;
    // Draw black border above image.
    image.scan(0, 0, 1080, 20, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0x000000FF, offset);
    });
    computedHeight = computedHeight + 20;
    // Draw black border on the left of image.
    image.scan(0, 0, 20, 960, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0x000000FF, offset);
    });
    // Draw black border on the right of image.
    image.scan(1060, 0, 20, 960, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0x000000FF, offset);
    });
    // Draw black border below image.
    image.scan(0, 940, 1080, 20, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0x000000FF, offset);
    });
    computedHeight = computedHeight + 20;
    // Draw red banner above title section.
    image.scan(0, 960, 1080, 100, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0xD00000FF, offset);
    });
    computedHeight = computedHeight + 100;
    // Draw red banner below title section.
    image.scan(0, 1820, 1080, 100, function (_x, _y, offset) {
        this.bitmap.data.writeUInt32BE(0xD00000FF, offset);
    });
    computedHeight = computedHeight + 100;
    // Add logo.
    image.composite(logo, 900, 1830, {
        mode: jimp_1.default.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1
    });
    // Print title.
    const titleHeight = jimp_1.default.measureTextHeight(titleFont, title, 1000 - 50 - 50);
    if (computedHeight + titleHeight >= 1920) {
        image.print(smallTitleFont, 50, 1060, {
            text: title,
            alignmentX: jimp_1.default.HORIZONTAL_ALIGN_LEFT,
            alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
        }, (1080 - 50 - 50), (1820 - 1060));
    }
    else {
        image.print(titleFont, 50, 1060, {
            text: title,
            alignmentX: jimp_1.default.HORIZONTAL_ALIGN_LEFT,
            alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
        }, (1080 - 50 - 50), (1820 - 1060));
    }
    image.write(`./assets/output/story/${index}.jpg`);
    // return await image.getBase64Async(Jimp.MIME_JPEG);
});
const checkAndPublish = (ig, declarative) => __awaiter(void 0, void 0, void 0, function* () {
    const opIndiaArticles = (yield fetchOpIndiaArticles({ URL: links_1.OPINDIA_FEED, articleCount: 5 })).reverse(), theWireArticles = (yield fetchTheWireArticles({ URL: links_1.THEWIRE_EDITORS_PICK, articleCount: 5 })).reverse();
    declarative && console.log('✅ Fetched OpIndia and TheWire articles.');
    let lastOpIndiaArticleID = '', lastTheWireArticleID = '', newOpIndiaPosts = false, newTheWirePosts = false, articles = [];
    try {
        lastOpIndiaArticleID = fs_1.default.readFileSync('./opindia.mohini', { encoding: 'utf-8' }).toString();
        const lastOpIndiaArticleIDIndex = opIndiaArticles.findIndex(opIndiaArticle => opIndiaArticle.articleID === lastOpIndiaArticleID);
        if (lastOpIndiaArticleID === opIndiaArticles[opIndiaArticles.length - 1].articleID) {
            newOpIndiaPosts = false;
        }
        else if (lastOpIndiaArticleIDIndex !== -1) {
            newOpIndiaPosts = true;
            fs_1.default.writeFileSync('./opindia.mohini', opIndiaArticles[opIndiaArticles.length - 1].articleID, { encoding: 'utf-8' });
            opIndiaArticles.splice(0, lastOpIndiaArticleIDIndex + 1);
        }
        else if (lastOpIndiaArticleIDIndex === -1) {
            newOpIndiaPosts = true;
            fs_1.default.writeFileSync('./opindia.mohini', opIndiaArticles[opIndiaArticles.length - 1].articleID, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        newOpIndiaPosts = true;
        if (e.code === 'ENOENT') {
            fs_1.default.writeFileSync('./opindia.mohini', opIndiaArticles[opIndiaArticles.length - 1].articleID, { encoding: 'utf-8' });
        }
        else {
            console.error(e);
        }
    }
    try {
        lastTheWireArticleID = fs_1.default.readFileSync('./thewire.mohini', { encoding: 'utf-8' }).toString();
        const lastTheWireArticleIDIndex = theWireArticles.findIndex(theWireArticle => theWireArticle.articleID === lastTheWireArticleID);
        if (lastTheWireArticleID === theWireArticles[theWireArticles.length - 1].articleID) {
            newTheWirePosts = false;
        }
        else if (lastTheWireArticleIDIndex !== -1) {
            newTheWirePosts = true;
            fs_1.default.writeFileSync('./thewire.mohini', theWireArticles[theWireArticles.length - 1].articleID, { encoding: 'utf-8' });
            theWireArticles.splice(0, lastTheWireArticleIDIndex + 1);
        }
        else if (lastTheWireArticleIDIndex === -1) {
            newTheWirePosts = true;
            fs_1.default.writeFileSync('./thewire.mohini', theWireArticles[theWireArticles.length - 1].articleID, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        newTheWirePosts = true;
        if (e.code === 'ENOENT') {
            fs_1.default.writeFileSync('./thewire.mohini', theWireArticles[theWireArticles.length - 1].articleID, { encoding: 'utf-8' });
        }
        else {
            console.error(e);
        }
    }
    if (!newOpIndiaPosts && !newTheWirePosts) {
        declarative && console.log('🧊 No new articles to post!');
        return;
    }
    else {
        declarative && console.log('🔥 New articles to post!');
    }
    const opIndiaArticleTexts = yield Promise.all(opIndiaArticles.map((opIndiaArticle) => __awaiter(void 0, void 0, void 0, function* () { return yield fetchOpIndiaArticle(opIndiaArticle.articleLink); }))), theWireArticleTexts = yield Promise.all(theWireArticles.map((theWireArticle) => __awaiter(void 0, void 0, void 0, function* () { return yield fetchTheWireArticle(theWireArticle.articleLink); }))), opIndiaArticleHashtags = opIndiaArticleTexts.map(opIndiaArticleText => getHashtags(opIndiaArticleText)), theWireArticleHashtags = theWireArticleTexts.map(theWireArticleText => getHashtags(theWireArticleText));
    opIndiaArticles.forEach((opIndiaArticle, i, array) => array[i] = Object.assign(Object.assign({}, opIndiaArticle), { caption: `${lodash_1.default.truncate(opIndiaArticleTexts[i], { length: 2000 - opIndiaArticleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n')}\n⠀\n${opIndiaArticleHashtags[i]}` }));
    theWireArticles.forEach((theWireArticle, i, array) => array[i] = Object.assign(Object.assign({}, theWireArticle), { caption: `${lodash_1.default.truncate(theWireArticleTexts[i], { length: 2000 - theWireArticleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n')}\n⠀\n${theWireArticleHashtags[i]}` }));
    articles = articles.concat(opIndiaArticles).concat(theWireArticles);
    articles = knuthShuffle(articles);
    for (const [i, article] of articles.entries()) {
        if (article.source === sources_1.THEWIRE) {
            const result = yield axios_1.default.get(article.articleLink);
            const $ = cheerio_1.default.load(result.data);
            article.excerpt = $('.shortDesc').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
        }
        declarative && console.log(`🌺 Posting ${article.articleID} as a photo...`);
        yield createPost(article.headerImageURL, article.title, article.excerpt, i);
        yield sleep(5 * 1000);
        yield ig.publish.photo({
            file: fs_1.default.readFileSync(`./assets/output/posts/${i}.jpg`),
            caption: article.caption
        });
        declarative && console.log('✅ Posted!');
        declarative && console.log('⌚ Waiting 30 seconds to avoid ban...');
        yield sleep(30 * 1000);
        declarative && console.log(`🌺 Posting ${article.articleID} as a story...`);
        yield createStory(article.headerImageURL, article.title, i);
        yield sleep(5 * 1000);
        yield ig.publish.story({
            file: fs_1.default.readFileSync(`./assets/output/story/${i}.jpg`)
        });
        declarative && console.log('⌚ Waiting 30 seconds to avoid ban...');
        yield sleep(30 * 1000);
        declarative && console.log('✅ Posted!');
    }
    declarative && console.log('✅ All articles were posted!');
});
const engine = ({ declarative }) => __awaiter(void 0, void 0, void 0, function* () {
    declarative && console.log('🌺 Initializing Mohini...');
    const ig = new instagram_private_api_1.IgApiClient();
    ig.state.generateDevice(credentials_1.IG_USERNAME);
    declarative && console.log('✅ Generated new device.');
    declarative && console.log('🌺 Logging in...');
    yield ig.account.login(credentials_1.IG_USERNAME, credentials_1.IG_PASSWORD);
    declarative && console.log('✅ Logged in to account.');
    // First run.
    declarative && console.log('🌺 Checking for new articles...');
    yield checkAndPublish(ig, declarative);
    declarative && console.log('⌚ Checking in after 30 minutes!');
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        declarative && console.log('🌺 Checking for new articles...');
        yield checkAndPublish(ig, declarative);
        declarative && console.log('⌚ Checking in after 30 minutes!');
    }), 30 * 60 * 1000);
});
engine({ declarative: true });
//# sourceMappingURL=index.js.map