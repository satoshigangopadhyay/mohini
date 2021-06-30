// Packages:
import axios from 'axios';
import cheerio from 'cheerio';
import striptags from 'striptags';
import stopword from 'stopword';
import kirak32 from './tools/kirak32';
import Jimp from 'jimp';
import fs from 'fs';
import { IgApiClient } from 'instagram-private-api';
import _ from 'lodash';


// Typescript:
interface IArticle {
  headerImageURL: string;
  title: string;
  category: string;
  articleLink: string;
  articleID: string;
  author: string;
  excerpt: string;
  source: string;
  caption: string;
};


// Constants:
import { OPINDIA_FEED, THEWIRE_EDITORS_PICK } from './constants/links';
import { IG_PASSWORD, IG_USERNAME } from './constants/credentials';
import { OPINDIA, THEWIRE } from './constants/sources';


// Functions:
const knuthShuffle = (array: any[]) => {
  let currentIndex = array.length, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [ array[ currentIndex ], array[ randomIndex ] ]
    =
    [ array[ randomIndex ], array[ currentIndex ] ];
  }
  return array;
}

const sleep = async (ms: number) => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

const nthMostCommon = (wordsArray: string[], amount: number): { word: string, occurrences: number }[] => {
  const wordOccurrences: any = {};
  for (let i = 0; i < wordsArray.length; i++) {
    wordOccurrences['_' + wordsArray[ i ]] = (wordOccurrences['_' + wordsArray[ i ]] || 0) + 1;
  }
  const result = Object.keys(wordOccurrences).reduce((acc: any[], currentKey) => {
    for (let i = 0; i < amount; i++) {
      if (!acc[i]) {
        acc[i] = { word: currentKey.slice(1, currentKey.length), occurences: wordOccurrences[ currentKey ] };
        break;
      } else if (acc[i].occurences < wordOccurrences[ currentKey ]) {
        acc.splice(i, 0, { word: currentKey.slice(1, currentKey.length), occurences: wordOccurrences[ currentKey ] });
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

const getHashtags = (article: string) => {
  return nthMostCommon(stopword.removeStopwords(article.toLocaleLowerCase().split(/\s/)), 15)
    .filter(commonWord => RegExp(/^#?[^\s!@#$%^&*()=+./,\[{\]};:'"?><]+$/g).test(commonWord.word))
    .map(commonWord => `#${ commonWord.word }`).join(' ');
};

const fetchOpIndiaArticle = async (URL: string) => {
  const result = await axios.get(URL);
  const $ = cheerio.load(result.data);
  let article = '';
  $('.wpb_column.vc_column_container.tdc-column.td-pb-span8 > .wpb_wrapper')
    .find('.td_block_wrap.tdb_single_content.td-pb-border-top.td_block_template_1.td-post-content.tagdiv-type > .tdb-block-inner.td-fix-index')
    .find('p').each((_i, element) => {
      const paragraph = $(element).html();
      if (paragraph !== null) {
        article = article.concat(`\n${ striptags(paragraph) }`);
      }
    });
  return article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
};

const fetchOpIndiaArticles = async ({ URL, articleCount }: { URL: string, articleCount: number }) => {
  const articles: IArticle[] = [];
  const result = await axios.get(URL);
  const $ = cheerio.load(result.data);
  $('.td_block_inner.tdb-block-inner.td-fix-index .tdb_module_loop.td_module_wrap.td-animation-stack').each((i, element) => {
    if (i < articleCount) {
      const headerImageURL = $(element).find('.td-image-container > .td-module-thumb').find('a > span').attr('data-img-url') ?? '';
      const title = ($(element).find('.td-image-container > .td-module-thumb').find('a').attr('title') ?? '').replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
      const category = $(element).find('.td-image-container > .td-post-category').text();
      const articleLink = $(element).find('.td-module-meta-info > .entry-title.td-module-title').find('a').attr('href') ?? '';
      const articleID = articleLink ? kirak32(articleLink) : '0';
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
        source: OPINDIA,
        caption: ''
      });
    }
  });
  return articles;
};

const fetchTheWireArticle = async (URL: string) => {
  const result = await axios.get(URL);
  const $ = cheerio.load(result.data);
  let article = '';
  $('.grey-text').find('p').each((_i, element) => {
    const paragraph = $(element).html();
    if (paragraph !== null) {
      article = article.concat(`\n${ striptags(paragraph) }`);
    }
  });
  return article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
};

const fetchTheWireArticles = async ({ URL, articleCount }: { URL: string, articleCount: number }) => {
  const articles: IArticle[] = [];
  const result = await axios.get(URL);
  const $ = cheerio.load(result.data);
  $('.card__header + .card__content-wrapper').find('div').find('.card.horizontal.card__header--rm-margin.row-height').each((i, element) => {
    if (i < articleCount) {
      const headerImageURL = $(element).find('.card-image > a > img').attr('src') ?? '';
      const title = $(element).find('.card-stacked > .card-content > .card__title > a').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`) ?? '';
      const category = $(element).find('.card-stacked > .card-content > a > .tag').text();
      const articleLink = 'https://thewire.in' + ($(element).find('.card-stacked > .card-content > .card__title > a').attr('href') ?? '');
      const articleID = articleLink ? kirak32(articleLink) : '0';
      const author = $(element).find('.card-stacked > .card-content > .card__author-name.hide-on-small-only > a').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
      articles.push({
        headerImageURL,
        title,
        category,
        articleLink,
        articleID,
        author: author === 'The Wire Staff' ? 'External Sources' : author,
        excerpt: '',
        source: THEWIRE,
        caption: ''
      });
    }
  });
  return articles;
};

const createPost = async (headerImageURL: string, title: string, excerpt: string, index: number) => {
  const image = new Jimp(1000, 1000, '#FFFFFF');
  const headerImage = (await Jimp.read(headerImageURL)).cover(1000, 500);
  const logo = (await Jimp.read('./assets/logo/thewiredwatermark.jpg')).resize(125, 50);
  const titleFont = await Jimp.loadFont('./assets/fonts/josefin-sans-48-black-bold/josefin-sans-48-black-bold.fnt');
  const excerptFont = await Jimp.loadFont('./assets/fonts/josefin-sans-40-black-light/josefin-sans-40-black-light.fnt');
  let computedHeight = 0;

  // Add header image.
  image.composite(headerImage, 0, 0, {
    mode: Jimp.BLEND_SOURCE_OVER,
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
    mode: Jimp.BLEND_SOURCE_OVER,
    opacityDest: 1,
    opacitySource: 1
  });

  // Print title.
  const titleHeight = Jimp.measureTextHeight(titleFont, title, 1000 - 50 - 50);
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
    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
  }, 1000 - 50 - 50, 1000 - computedHeight);

  image.write(`./assets/output/posts/${ index }.jpg`);
  // return await image.getBase64Async(Jimp.MIME_JPEG);
};

const createStory = async (headerImageURL: string, title: string, index: number) => {
  const image = new Jimp(1080, 1920, '#000000');
  const headerImage = (await Jimp.read(headerImageURL)).cover(1080, 960);
  const logo = (await Jimp.read('./assets/logo/thewiredstorywatermark.jpg')).resize(175, 75);
  const titleFont = await Jimp.loadFont('./assets/fonts/josefin-sans-96-white-bold/josefin-sans-96-white-bold.fnt');
  const smallTitleFont = await Jimp.loadFont('./assets/fonts/josefin-sans-64-white-bold/josefin-sans-64-white-bold.fnt');
  let computedHeight = 0;

  // Add header image.
  image.composite(headerImage, 0, 0, {
    mode: Jimp.BLEND_SOURCE_OVER,
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
    mode: Jimp.BLEND_SOURCE_OVER,
    opacityDest: 1,
    opacitySource: 1
  });

  // Print title.
  const titleHeight = Jimp.measureTextHeight(titleFont, title, 1000 - 50 - 50);
  if (computedHeight + titleHeight >= 1920) {
    image.print(smallTitleFont, 50, 1060, {
      text: title,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, (1080 - 50 - 50), (1820 - 1060));
  } else {
    image.print(titleFont, 50, 1060, {
      text: title,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, (1080 - 50 - 50), (1820 - 1060));
  }

  image.write(`./assets/output/story/${ index }.jpg`);
  // return await image.getBase64Async(Jimp.MIME_JPEG);
};

const checkAndPublish = async (ig: IgApiClient, declarative: boolean) => {
  const
    opIndiaArticles = (await fetchOpIndiaArticles({ URL: OPINDIA_FEED, articleCount: 5 })).reverse(),
    theWireArticles = (await fetchTheWireArticles({ URL: THEWIRE_EDITORS_PICK, articleCount: 5 })).reverse();
  declarative && console.log('✅ Fetched OpIndia and TheWire articles.');
  let lastOpIndiaArticleID = '', lastTheWireArticleID = '', newOpIndiaPosts = false, newTheWirePosts = false, articles: IArticle[] = [];
  try {
    lastOpIndiaArticleID = fs.readFileSync('./opindia.mohini', { encoding: 'utf-8' }).toString();
    const lastOpIndiaArticleIDIndex = opIndiaArticles.findIndex(opIndiaArticle => opIndiaArticle.articleID === lastOpIndiaArticleID);
    if (lastOpIndiaArticleID === opIndiaArticles[ opIndiaArticles.length - 1 ].articleID) {
      newOpIndiaPosts = false;
    } else if (lastOpIndiaArticleIDIndex !== -1) {
      newOpIndiaPosts = true;
      fs.writeFileSync('./opindia.mohini', opIndiaArticles[ opIndiaArticles.length - 1 ].articleID, { encoding: 'utf-8' });
      opIndiaArticles.splice(0, lastOpIndiaArticleIDIndex + 1);
    } else if (lastOpIndiaArticleIDIndex === -1) {
      newOpIndiaPosts = true;
      fs.writeFileSync('./opindia.mohini', opIndiaArticles[ opIndiaArticles.length - 1 ].articleID, { encoding: 'utf-8' });
    }
  } catch(e) {
    newOpIndiaPosts = true;
    if (e.code === 'ENOENT') {
      fs.writeFileSync('./opindia.mohini', opIndiaArticles[ opIndiaArticles.length - 1 ].articleID, { encoding: 'utf-8' });
    } else {
      console.error(e);
    }
  }
  try {
    lastTheWireArticleID = fs.readFileSync('./thewire.mohini', { encoding: 'utf-8' }).toString();
    const lastTheWireArticleIDIndex = theWireArticles.findIndex(theWireArticle => theWireArticle.articleID === lastTheWireArticleID);
    if (lastTheWireArticleID === theWireArticles[ theWireArticles.length - 1 ].articleID) {
      newTheWirePosts = false;
    } else if (lastTheWireArticleIDIndex !== -1) {
      newTheWirePosts = true;
      fs.writeFileSync('./thewire.mohini', theWireArticles[ theWireArticles.length - 1 ].articleID, { encoding: 'utf-8' });
      theWireArticles.splice(0, lastTheWireArticleIDIndex + 1);
    } else if (lastTheWireArticleIDIndex === -1) {
      newTheWirePosts = true;
      fs.writeFileSync('./thewire.mohini', theWireArticles[ theWireArticles.length - 1 ].articleID, { encoding: 'utf-8' });
    }
  } catch(e) {
    newTheWirePosts = true;
    if (e.code === 'ENOENT') {
      fs.writeFileSync('./thewire.mohini', theWireArticles[ theWireArticles.length - 1 ].articleID, { encoding: 'utf-8' });
    } else {
      console.error(e);
    }
  }
  if (!newOpIndiaPosts && !newTheWirePosts) {
    declarative && console.log('🧊 No new articles to post!');
    return;
  } else {
    declarative && console.log('🔥 New articles to post!');
  }
  const
    opIndiaArticleTexts = await Promise.all(opIndiaArticles.map(async (opIndiaArticle) => await fetchOpIndiaArticle(opIndiaArticle.articleLink))),
    theWireArticleTexts = await Promise.all(theWireArticles.map(async (theWireArticle) => await fetchTheWireArticle(theWireArticle.articleLink))),
    opIndiaArticleHashtags = opIndiaArticleTexts.map(opIndiaArticleText => getHashtags(opIndiaArticleText)),
    theWireArticleHashtags = theWireArticleTexts.map(theWireArticleText => getHashtags(theWireArticleText));
  opIndiaArticles.forEach((opIndiaArticle, i, array) => array[i] = { ...opIndiaArticle, caption: `${ _.truncate(opIndiaArticleTexts[i], { length: 2000 - opIndiaArticleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n') }\n⠀\n${ opIndiaArticleHashtags[i] }` });
  theWireArticles.forEach((theWireArticle, i, array) => array[i] = { ...theWireArticle, caption: `${ _.truncate(theWireArticleTexts[i], { length: 2000 - theWireArticleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n') }\n⠀\n${ theWireArticleHashtags[i] }` });
  articles = articles.concat(opIndiaArticles).concat(theWireArticles);
  articles = knuthShuffle(articles);
  for (const [ i, article ] of articles.entries()) {
    if (article.source === THEWIRE) {
      const result = await axios.get(article.articleLink);
      const $ = cheerio.load(result.data);
      article.excerpt = $('.shortDesc').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
    }
    declarative && console.log(`🌺 Posting ${ article.articleID } as a photo...`);
    await createPost(article.headerImageURL, article.title, article.excerpt, i);
    await sleep(5 * 1000);
    await ig.publish.photo({
      file: fs.readFileSync(`./assets/output/posts/${ i }.jpg`),
      caption: article.caption
    });
    declarative && console.log('✅ Posted!');
    declarative && console.log('⌚ Waiting 30 seconds to avoid ban...');
    await sleep(30 * 1000);
    declarative && console.log(`🌺 Posting ${ article.articleID } as a story...`);
    await createStory(article.headerImageURL, article.title, i);
    await sleep(5 * 1000);
    await ig.publish.story({
      file: fs.readFileSync(`./assets/output/story/${ i }.jpg`)
    });
    declarative && console.log('⌚ Waiting 30 seconds to avoid ban...');
    await sleep(30 * 1000);
    declarative && console.log('✅ Posted!');
  }
  declarative && console.log('✅ All articles were posted!');
};

const engine = async ({ declarative }: { declarative: boolean }) => {
  declarative && console.log('🌺 Initializing Mohini...');
  const ig = new IgApiClient();
  ig.state.generateDevice(IG_USERNAME);
  declarative && console.log('✅ Generated new device.');
  declarative && console.log('🌺 Logging in...');
  await ig.account.login(IG_USERNAME, IG_PASSWORD);
  declarative && console.log('✅ Logged in to account.');

  // First run.
  declarative && console.log('🌺 Checking for new articles...');
  await checkAndPublish(ig, declarative);
  declarative && console.log('⌚ Checking in after 30 minutes!');

  setInterval(async () => {
    declarative && console.log('🌺 Checking for new articles...');
    await checkAndPublish(ig, declarative);
    declarative && console.log('⌚ Checking in after 30 minutes!');
  }, 30 * 60 * 1000);
};

engine({ declarative: true });
