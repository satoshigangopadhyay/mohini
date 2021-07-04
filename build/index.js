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
const srcset_1 = __importDefault(require("srcset"));
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
const MINUTE = 60 * 1000, HOUR = 60 * MINUTE;
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
const getAllItemsFromFeed = (feed) => __awaiter(void 0, void 0, void 0, function* () {
    let items = [];
    do {
        items = items.concat(yield feed.items());
        const time = Math.round(Math.random() * 4000) + 1000;
        yield sleep(time);
    } while (feed.isMoreAvailable());
    return items;
});
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
const fetchOpIndiaArticles = ({ URL, articleCount, declarative }) => __awaiter(void 0, void 0, void 0, function* () {
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
    declarative && console.log('✅ Fetched OpIndia\'s articles.');
    articles.reverse();
    let newPosts = false;
    try {
        const lastArticleID = fs_1.default.readFileSync('./opindia.mohini', { encoding: 'utf-8' }).toString();
        const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
        if (lastArticleID === articles[articles.length - 1].articleID) {
            newPosts = false;
        }
        else if (lastArticleIDIndex !== -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./opindia.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
            articles.splice(0, lastArticleIDIndex + 1);
        }
        else if (lastArticleIDIndex === -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./opindia.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        newPosts = true;
        if (e.code === 'ENOENT') {
            fs_1.default.writeFileSync('./opindia.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
        else {
            console.error(e);
        }
    }
    if (newPosts) {
        declarative && console.log('🔥 New articles to post from OpIndia!');
        const articleTexts = yield Promise.all(articles.map((article) => __awaiter(void 0, void 0, void 0, function* () { return yield fetchOpIndiaArticle(article.articleLink); }))), articleHashtags = articleTexts.map(articleText => getHashtags(articleText));
        articles.forEach((article, i, array) => array[i] = Object.assign(Object.assign({}, article), { caption: `${lodash_1.default.truncate(articleTexts[i], { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ')}\n⠀\n${articleHashtags[i]}\n⠀\nSource: OpIndia` }));
        return articles;
    }
    else {
        declarative && console.log('🥶 No new articles to post from OpIndia!');
        return [];
    }
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
const fetchTheWireArticles = ({ URL, articleCount, declarative }) => __awaiter(void 0, void 0, void 0, function* () {
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
    declarative && console.log('✅ Fetched The Wire\'s articles.');
    articles.reverse();
    let newPosts = false;
    try {
        const lastArticleID = fs_1.default.readFileSync('./thewire.mohini', { encoding: 'utf-8' }).toString();
        const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
        if (lastArticleID === articles[articles.length - 1].articleID) {
            newPosts = false;
        }
        else if (lastArticleIDIndex !== -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./thewire.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
            articles.splice(0, lastArticleIDIndex + 1);
        }
        else if (lastArticleIDIndex === -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./thewire.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        newPosts = true;
        if (e.code === 'ENOENT') {
            fs_1.default.writeFileSync('./thewire.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
        else {
            console.error(e);
        }
    }
    if (newPosts) {
        declarative && console.log('🔥 New articles to post from The Wire!');
        const articleTexts = yield Promise.all(articles.map((article) => __awaiter(void 0, void 0, void 0, function* () { return yield fetchTheWireArticle(article.articleLink); }))), articleHashtags = articleTexts.map(articleText => getHashtags(articleText));
        articles.forEach((article, i, array) => array[i] = Object.assign(Object.assign({}, article), { caption: `${lodash_1.default.truncate(articleTexts[i], { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ')}\n⠀\n${articleHashtags[i]}\n⠀\nSource: The Wire` }));
        return articles;
    }
    else {
        declarative && console.log('🥶 No new articles to post from The Wire!');
        return [];
    }
});
const fetchSwarajyaArticle = (URL) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    let article = '';
    $('.story-element.story-element-text:not(.story-element-text-summary) > div > p').each((_i, element) => {
        const paragraph = $(element).text();
        if (paragraph !== null) {
            article = article.concat(`\n${striptags_1.default(paragraph)}`);
        }
    });
    if ($('.story-grid-m__smag-img-banner__1sMRD > img').attr('srcset') === undefined) {
        return {
            headerImageURL: `https:${(_b = lodash_1.default.maxBy(srcset_1.default.parse((_a = $('.story-grid-m__smag-img-banner__1sMRD > a > img').attr('srcset')) !== null && _a !== void 0 ? _a : ''), o => o.width)) === null || _b === void 0 ? void 0 : _b.url}`,
            caption: article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`)
        };
    }
    else {
        return {
            headerImageURL: `https:${(_d = lodash_1.default.maxBy(srcset_1.default.parse((_c = $('.story-grid-m__smag-img-banner__1sMRD > img').attr('srcset')) !== null && _c !== void 0 ? _c : ''), o => o.width)) === null || _d === void 0 ? void 0 : _d.url}`,
            caption: article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`)
        };
    }
});
const fetchSwarajyaArticles = ({ URL, articleCount, declarative }) => __awaiter(void 0, void 0, void 0, function* () {
    const articles = [];
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    $('.latest-m__load-more-lt-container__XnqhO > div').each((i, element) => {
        var _a, _b, _c;
        if (i < articleCount) {
            const headerImageURL = '';
            const title = (_a = $(element).find('.latest-m__card__3vkwo > .latest-m__card-content__3MfaP > .latest-m__card-headline__7-HCL').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`)) !== null && _a !== void 0 ? _a : '';
            const category = '';
            const articleLink = URL + ((_b = $(element).find('.latest-m__card__3vkwo > a').attr('href')) !== null && _b !== void 0 ? _b : '');
            const articleID = articleLink ? kirak32_1.default(articleLink) : '0';
            const author = (_c = $(element).find('.latest-m__card__3vkwo > .latest-m__card-content__3MfaP > .latest-m__card-author__2sAya').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`)) !== null && _c !== void 0 ? _c : '';
            articles.push({
                headerImageURL,
                title,
                category,
                articleLink,
                articleID,
                author: author === 'Swarajya Staff' ? 'External Sources' : author,
                excerpt: '',
                source: sources_1.SWARAJYA,
                caption: ''
            });
        }
    });
    declarative && console.log('✅ Fetched Swarajya\'s articles.');
    articles.reverse();
    let newPosts = false;
    try {
        const lastArticleID = fs_1.default.readFileSync('./swarajya.mohini', { encoding: 'utf-8' }).toString();
        const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
        if (lastArticleID === articles[articles.length - 1].articleID) {
            newPosts = false;
        }
        else if (lastArticleIDIndex !== -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./swarajya.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
            articles.splice(0, lastArticleIDIndex + 1);
        }
        else if (lastArticleIDIndex === -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./swarajya.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        newPosts = true;
        if (e.code === 'ENOENT') {
            fs_1.default.writeFileSync('./swarajya.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
        else {
            console.error(e);
        }
    }
    if (newPosts) {
        declarative && console.log('🔥 New articles to post from Swarajya!');
        const articleTextsAndHeaderImageURLs = yield Promise.all(articles.map((article) => __awaiter(void 0, void 0, void 0, function* () { return yield fetchSwarajyaArticle(article.articleLink); }))), articleHashtags = articleTextsAndHeaderImageURLs.map(articleTextsAndHeaderImageURL => getHashtags(articleTextsAndHeaderImageURL.caption));
        articles.forEach((article, i, array) => array[i] = Object.assign(Object.assign({}, article), { headerImageURL: articleTextsAndHeaderImageURLs[i].headerImageURL, caption: `${lodash_1.default.truncate(articleTextsAndHeaderImageURLs[i].caption, { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ')}\n⠀\n${articleHashtags[i]}\n⠀\nSource: Swarajya Magazine` }));
        return articles;
    }
    else {
        declarative && console.log('🥶 No new articles to postfrom Swarajya!');
        return [];
    }
});
const fetchTimesNowNewsArticle = (URL) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    let article = '';
    $('.artical-description > p').each((_i, element) => {
        const paragraph = $(element).text();
        if (paragraph !== null) {
            article = article.concat(`\n${striptags_1.default(paragraph)}`);
        }
    });
    return {
        headerImageURL: ((_e = $('.artical-description').find('.img-pod > img').attr('data-src')) !== null && _e !== void 0 ? _e : '').replace(/tr=w-[0-9]+,h-[0-9]+/g, 'tr=w-1000,h-500'),
        category: $('._consumption_cat > ._heading_').text(),
        author: $('.consumption-content > .text > .name').text().trim(),
        excerpt: $('.consumption_intro > h2').text(),
        caption: article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`)
    };
});
const fetchTimesNowNewsArticles = ({ URL, articleCount, declarative }) => __awaiter(void 0, void 0, void 0, function* () {
    const articles = [];
    const result = yield axios_1.default.get(URL);
    const $ = cheerio_1.default.load(result.data);
    $('.search-box > a').each((i, element) => {
        var _a, _b;
        if (i < articleCount) {
            const title = (_a = $(element).find('.text').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`)) !== null && _a !== void 0 ? _a : '';
            const articleLink = (_b = $(element).attr('href')) !== null && _b !== void 0 ? _b : '';
            const articleID = articleLink ? kirak32_1.default(articleLink) : '0';
            articles.push({
                headerImageURL: '',
                title,
                category: '',
                articleLink,
                articleID,
                author: '',
                excerpt: '',
                source: sources_1.TIMESNOWNEWS,
                caption: ''
            });
        }
    });
    declarative && console.log('✅ Fetched Times Now News\' articles.');
    articles.reverse();
    let newPosts = false;
    try {
        const lastArticleID = fs_1.default.readFileSync('./timesnownews.mohini', { encoding: 'utf-8' }).toString();
        const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
        if (lastArticleID === articles[articles.length - 1].articleID) {
            newPosts = false;
        }
        else if (lastArticleIDIndex !== -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./timesnownews.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
            articles.splice(0, lastArticleIDIndex + 1);
        }
        else if (lastArticleIDIndex === -1) {
            newPosts = true;
            fs_1.default.writeFileSync('./timesnownews.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
    }
    catch (e) {
        newPosts = true;
        if (e.code === 'ENOENT') {
            fs_1.default.writeFileSync('./timesnownews.mohini', articles[articles.length - 1].articleID, { encoding: 'utf-8' });
        }
        else {
            console.error(e);
        }
    }
    if (newPosts) {
        declarative && console.log('🔥 New articles to post from Times Now News!');
        const articleBlobs = yield Promise.all(articles.map((article) => __awaiter(void 0, void 0, void 0, function* () { return yield fetchTimesNowNewsArticle(article.articleLink); }))), articleHashtags = articleBlobs.map(articleBlob => getHashtags(articleBlob.caption));
        articles.forEach((article, i, array) => array[i] = Object.assign(Object.assign({}, article), { headerImageURL: articleBlobs[i].headerImageURL, category: articleBlobs[i].category, author: articleBlobs[i].author, excerpt: articleBlobs[i].excerpt, caption: `${lodash_1.default.truncate(articleBlobs[i].caption, { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ')}\n⠀\n${articleHashtags[i]}\n⠀\nSource: Times Now News` }));
        return articles;
    }
    else {
        declarative && console.log('🥶 No new articles to postfrom Times Now News!');
        return [];
    }
});
const createPost = (headerImageURL, title, excerpt, index) => __awaiter(void 0, void 0, void 0, function* () {
    const image = new jimp_1.default(1000, 1000, '#FFFFFF');
    const headerImage = (yield jimp_1.default.read(headerImageURL)).cover(1000, 500);
    const logo = (yield jimp_1.default.read('./assets/logo/thewiredwatermark.jpg')).resize(125, 50);
    let computedHeight = 0;
    const randomIndex = Math.floor(Math.random() * 3);
    if (randomIndex === 0) {
        const titleFont = yield jimp_1.default.loadFont('./assets/fonts/josefin-sans-48-black-bold/josefin-sans-48-black-bold.fnt');
        const excerptFont = yield jimp_1.default.loadFont('./assets/fonts/josefin-sans-40-black-light/josefin-sans-40-black-light.fnt');
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
    }
    else if (randomIndex === 1) {
        const smallTitleFont = yield jimp_1.default.loadFont('./assets/fonts/roboto-48-black-bold/roboto-48-black-bold.fnt');
        const largeTitleFont = yield jimp_1.default.loadFont('./assets/fonts/roboto-64-black-bold/roboto-64-black-bold.fnt');
        const excerptFont = yield jimp_1.default.loadFont('./assets/fonts/roboto-32-black-regular/roboto-32-black-regular.fnt');
        let titleFont = smallTitleFont;
        // Add header image.
        image.composite(headerImage, 0, 0, {
            mode: jimp_1.default.BLEND_SOURCE_OVER,
            opacityDest: 1,
            opacitySource: 1
        });
        computedHeight = computedHeight + headerImage.getHeight();
        // Add logo.
        image.composite(logo, 0, 0, {
            mode: jimp_1.default.BLEND_SOURCE_OVER,
            opacityDest: 1,
            opacitySource: 1
        });
        // Calculate theoretical height with small title.
        const totalHeight = 500 + (30 + jimp_1.default.measureTextHeight(smallTitleFont, title, 1000 - 50 - 50)) + (30 + 10) + (50 + jimp_1.default.measureTextHeight(excerptFont, excerpt, 1000 - 50 - 50) + 50);
        if (totalHeight <= 900) {
            // Use large title.
            titleFont = largeTitleFont;
        }
        else {
            // Use small title.
            titleFont = smallTitleFont;
        }
        // Print title.
        const titleHeight = jimp_1.default.measureTextHeight(titleFont, title, 1000 - 50 - 50);
        image.print(titleFont, 50, headerImage.getHeight() + 30, {
            text: title,
            alignmentX: jimp_1.default.HORIZONTAL_ALIGN_CENTER,
            alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
        }, 1000 - 50 - 50, titleHeight);
        computedHeight = computedHeight + titleHeight + 30;
        // Draw middle border.
        image.scan(50, computedHeight + 30, 900, 10, function (_x, _y, offset) {
            this.bitmap.data.writeUInt32BE(0xBD000AFF, offset);
        });
        computedHeight = computedHeight + 30 + 10;
        // Print excerpt.
        image.print(excerptFont, 50, computedHeight, {
            text: excerpt,
            alignmentX: jimp_1.default.HORIZONTAL_ALIGN_CENTER,
            alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
        }, 1000 - 50 - 50, 1000 - computedHeight);
        computedHeight = 1000;
    }
    else if (randomIndex === 2) {
        const smallTitleFont = yield jimp_1.default.loadFont('./assets/fonts/roboto-48-black-bold/roboto-48-black-bold.fnt');
        const largeTitleFont = yield jimp_1.default.loadFont('./assets/fonts/roboto-64-black-bold/roboto-64-black-bold.fnt');
        const excerptFont = yield jimp_1.default.loadFont('./assets/fonts/roboto-32-black-regular/roboto-32-black-regular.fnt');
        let titleFont = smallTitleFont;
        // Add header image.
        image.composite(headerImage, 0, 500, {
            mode: jimp_1.default.BLEND_SOURCE_OVER,
            opacityDest: 1,
            opacitySource: 1
        });
        // Draw left border.
        image.scan(0, 0, 10, 1000, function (_x, _y, offset) {
            this.bitmap.data.writeUInt32BE(0xBD000AFF, offset);
        });
        // Add logo.
        image.composite(logo, 875, 0, {
            mode: jimp_1.default.BLEND_SOURCE_OVER,
            opacityDest: 1,
            opacitySource: 1
        });
        // Calculate theoretical height with small title.
        const totalHeight = (75 + jimp_1.default.measureTextHeight(smallTitleFont, title, 1000 - 50 - 50)) + (25 + jimp_1.default.measureTextHeight(excerptFont, excerpt, 1000 - 50 - 50) + 50);
        if (totalHeight <= 420) {
            // Use large title.
            titleFont = largeTitleFont;
        }
        else {
            // Use small title.
            titleFont = smallTitleFont;
        }
        // Print title.
        const titleHeight = jimp_1.default.measureTextHeight(titleFont, title, 1000 - 50 - 50);
        image.print(titleFont, 50, 75, {
            text: title,
            alignmentX: jimp_1.default.HORIZONTAL_ALIGN_LEFT,
            alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
        }, 1000 - 50 - 50, titleHeight);
        computedHeight = computedHeight + titleHeight + 75;
        // Print excerpt.
        image.print(excerptFont, 50, computedHeight + 25, {
            text: excerpt,
            alignmentX: jimp_1.default.HORIZONTAL_ALIGN_LEFT,
            alignmentY: jimp_1.default.VERTICAL_ALIGN_MIDDLE
        }, 1000 - 50 - 50, 500 - computedHeight - 25 - 50);
    }
    image.write(`./assets/output/posts/${index}.jpg`);
    return;
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
});
const checkAndPublish = (ig, declarative) => __awaiter(void 0, void 0, void 0, function* () {
    const opIndiaArticles = yield fetchOpIndiaArticles({ URL: links_1.OPINDIA_FEED, articleCount: 4, declarative }), theWireArticles = yield fetchTheWireArticles({ URL: links_1.THEWIRE_EDITORS_PICK, articleCount: 3, declarative }), swarajyaArticles = yield fetchSwarajyaArticles({ URL: links_1.SWARAJYA_FEED, articleCount: 3, declarative }), timesNowNewsArticles = (Math.round(Math.random() * 2) === 0) ? yield fetchTimesNowNewsArticles({ URL: links_1.TIMES_NOW_NEWS_FEED, articleCount: 1, declarative: true }) : [];
    const articles = knuthShuffle(opIndiaArticles.concat(theWireArticles).concat(swarajyaArticles).concat(timesNowNewsArticles));
    if (articles.length === 0) {
        return;
    }
    for (const [i, article] of articles.entries()) {
        if (article.source === sources_1.THEWIRE) {
            const result = yield axios_1.default.get(article.articleLink);
            const $ = cheerio_1.default.load(result.data);
            article.excerpt = $('.shortDesc').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
        }
        else if (article.source === sources_1.SWARAJYA) {
            const result = yield axios_1.default.get(article.articleLink);
            const $ = cheerio_1.default.load(result.data);
            const excerpt = $('.story-element.story-element-text.story-element-text-summary > div > p').first().text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
            if (excerpt === '') {
                article.excerpt = lodash_1.default.truncate(article.caption, { length: 100 });
            }
            else {
                article.excerpt = excerpt;
            }
        }
        declarative && console.log(`🌺 Posting ${article.articleID} as a photo...`);
        yield createPost(article.headerImageURL, article.title.trim(), article.excerpt.trim(), i);
        yield sleep(Math.round(Math.random() * 4000) + 1000);
        const uploadId = Date.now().toString();
        yield ig.upload.photo({
            file: fs_1.default.readFileSync(`./assets/output/posts/${i}.jpg`),
            uploadId
        });
        declarative && console.log('✅ Posted!');
        declarative && console.log('🌺 Adding caption...');
        const configureOptions = {
            upload_id: uploadId,
            width: 1000,
            height: 1000,
            caption: article.caption
        };
        yield ig.media.checkOffensiveComment(article.caption);
        const configureResult = yield ig.media.configure(configureOptions);
        if (configureResult.media.caption === null) {
            declarative && console.log(`⌚ Caption could not be added to ${article.articleID}! Waiting 5 minutes..`);
            const captionFillInterval = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
                if ((yield ig.media.configure(configureOptions)).media.caption !== null) {
                    declarative && console.log(`✅ Caption added to ${article.articleID}!`);
                    clearInterval(captionFillInterval);
                }
                else {
                    declarative && console.log(`⌚ Caption could not be added to ${article.articleID}! Waiting 5 minutes..`);
                }
            }), 5 * MINUTE);
        }
        else {
            declarative && console.log('✅ Caption added!');
        }
        // Stories have a 50% chances of being posted.
        if (Math.round(Math.random()) === 0) {
            declarative && console.log('⌚ Waiting 30 seconds to 1 minute to avoid ban...');
            yield sleep(Math.round(Math.random() * 30000) + 30000);
            declarative && console.log(`🌺 Posting ${article.articleID} as a story...`);
            yield createStory(article.headerImageURL, article.title.trim(), i);
            yield sleep(Math.round(Math.random() * 4000) + 1000);
            yield ig.publish.story({
                file: fs_1.default.readFileSync(`./assets/output/story/${i}.jpg`)
            });
            declarative && console.log('✅ Posted!');
        }
        declarative && console.log('⌚ Waiting 2 to 5 minutes to avoid ban...');
        yield sleep(Math.round(Math.random() * 3 * MINUTE) + 2 * MINUTE);
    }
    declarative && console.log('✅ All articles were posted!');
});
const engine = ({ declarative }) => __awaiter(void 0, void 0, void 0, function* () {
    declarative && console.log('🌺 Initializing Mohini...');
    const ig = new instagram_private_api_1.IgApiClient();
    ig.state.generateDevice(credentials_1.IG_USERNAME);
    declarative && console.log('✅ Generated new device.');
    declarative && console.log('🌺 Logging in...');
    yield ig.simulate.preLoginFlow();
    const loggedInUser = yield ig.account.login(credentials_1.IG_USERNAME, credentials_1.IG_PASSWORD);
    process.nextTick(() => __awaiter(void 0, void 0, void 0, function* () { return yield ig.simulate.postLoginFlow(); }));
    declarative && console.log('✅ Logged in to account.');
    // First run.
    declarative && console.log('🌺 Checking for new articles...');
    yield checkAndPublish(ig, declarative);
    declarative && console.log('⌚ Checking in after 45 minutes!');
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        declarative && console.log('🌺 Checking for new articles...');
        yield checkAndPublish(ig, declarative);
        declarative && console.log('⌚ Checking in after 45 minutes!');
    }), 45 * MINUTE);
    // Follow new users (8 of n).
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        let counter = 0;
        try {
            declarative && console.log('🌺 Following 24 users...');
            const followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId), followers = yield getAllItemsFromFeed(followersFeed), followCount = followers.length, targetIndexes = [];
            while (targetIndexes.length < 3) {
                const r = Math.floor(Math.random() * followCount);
                if (targetIndexes.indexOf(r) === -1)
                    targetIndexes.push(r);
            }
            for (const targetIndex of targetIndexes) {
                const followerFollowersFeed = ig.feed.accountFollowers(followers[targetIndex].pk), followerFollowers = yield followerFollowersFeed.items(), subTargetIndexes = [];
                if (followerFollowers.length > 0) {
                    while (subTargetIndexes.length < 8) {
                        const r = Math.floor(Math.random() * followerFollowers.length);
                        if (subTargetIndexes.indexOf(r) === -1)
                            subTargetIndexes.push(r);
                    }
                    for (const subTargetIndex of subTargetIndexes) {
                        ig.friendship.create(followerFollowers[subTargetIndex].pk);
                        counter++;
                        const time = Math.round(Math.random() * 1000) + 1000;
                        yield sleep(time);
                    }
                    const time = Math.round(Math.random() * 9000) + 1000;
                    yield sleep(time);
                }
                else {
                    continue;
                }
            }
            declarative && console.log('✅ 24 users followed!');
        }
        catch (e) {
            declarative && console.error(`🍁 Encountered spam error, ${counter}/25 users followed.`);
        }
    }), 5.9 * HOUR);
    // Unfollow users.
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        let counter = 0;
        try {
            declarative && console.log('🌺 Unfollowing 25 users...');
            const followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId), followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId), followers = yield getAllItemsFromFeed(followersFeed), following = yield getAllItemsFromFeed(followingFeed), followersUsername = new Set(followers.map(({ username }) => username)), notFollowingYou = following.filter(({ username }) => !followersUsername.has(username));
            for (const [i, user] of notFollowingYou.entries()) {
                if (i <= 24) {
                    yield ig.friendship.destroy(user.pk);
                    counter++;
                    const time = Math.round(Math.random() * 9000) + 1000;
                    yield sleep(time);
                }
                else {
                    break;
                }
            }
            declarative && console.log('✅ 25 users unfollowed!');
        }
        catch (e) {
            declarative && console.error(`🍁 Encountered spam error, ${counter}/25 users unfollowed.`);
        }
    }), 6.1 * HOUR);
    // Cannibalize stories >6 hours.
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        declarative && console.log('🌺 Deleting old stories...');
        const storiesFeed = ig.feed.userStory(loggedInUser.pk), stories = yield getAllItemsFromFeed(storiesFeed);
        for (const story of stories) {
            if ((((Date.now() / 1000) - story.taken_at) / 60 / 60) > 6) {
                yield ig.media.delete({ mediaId: story.id });
                const time = Math.round(Math.random() * 9000) + 1000;
                yield sleep(time);
            }
        }
        declarative && console.log('✅ Old stories deleted!');
    }), 2.5 * HOUR);
    // Post promotional material.
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        const date = new Date(), hour = date.getHours();
        if (hour === 12) {
            yield ig.publish.photo({
                file: fs_1.default.readFileSync(`./assets/advert/0.jpg`),
                caption: `If West Taiwan tries to suppress free press, they're also suppressing our freedom of speech.\n⠀\nTogether we can prevent that from happening.`
            });
        }
        else if (hour === 15) {
            yield ig.publish.photo({
                file: fs_1.default.readFileSync(`./assets/advert/1.jpg`),
                caption: `We have the right to free speech.\n⠀\nBut those in power (in China) are trying to suppress it.\n⠀\nTogether we can prevent that from happening.\n⠀\nWill you help us?`
            });
        }
        else if (hour === 18) {
            yield ig.publish.photo({
                file: fs_1.default.readFileSync(`./assets/advert/2.jpg`),
                caption: `Suppressing the voices of journalists in West Taiwan won't suppress the truth.\n⠀\nLet's raise our voice together and speak truth to power.`
            });
        }
        else if (hour === 21) {
            yield ig.publish.photo({
                file: fs_1.default.readFileSync(`./assets/advert/3.jpg`),
                caption: `Stand with us while we hold power accountable and keep democracy alive in West Taiwan and in the West Indian Province of Pakistan.`
            });
        }
        else if (hour === 20) {
            yield ig.publish.photo({
                file: fs_1.default.readFileSync(`./assets/advert/4.jpg`),
                caption: `Please support us by sharing our posts! #AatmaNirbharBharat`
            });
        }
    }), 1 * HOUR);
});
engine({ declarative: true });
//# sourceMappingURL=index.js.map