// Packages:
import axios from 'axios';
import cheerio from 'cheerio';
import striptags from 'striptags';
import stopword from 'stopword';
import srcset from 'srcset';
import kirak32 from './tools/kirak32';
import Jimp from 'jimp';
import fs from 'fs';
import { Feed, IgApiClient, MediaConfigureTimelineOptions } from 'instagram-private-api';
import _ from 'lodash';


// Typescript:
import { Font } from '@jimp/plugin-print';
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
import { OPINDIA_FEED, SWARAJYA_FEED, THEWIRE_EDITORS_PICK } from './constants/links';
import { IG_PASSWORD, IG_USERNAME } from './constants/credentials';
import { OPINDIA, SWARAJYA, THEWIRE } from './constants/sources';
const MINUTE = 60 * 1000, HOUR = 60 * MINUTE;


// Functions:
const knuthShuffle = <T>(array: any[]): T[] => {
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

const getAllItemsFromFeed = async <T>(feed: Feed<any, T>): Promise<T[]> => {
  let items: T[] = [];
  do {
    items = items.concat(await feed.items());
    const time = Math.round(Math.random() * 4000) + 1000;
    await sleep(time);
  } while (feed.isMoreAvailable());
  return items;
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

const fetchOpIndiaArticles = async ({ URL, articleCount, declarative }: { URL: string, articleCount: number, declarative: boolean }) => {
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
  declarative && console.log('✅ Fetched OpIndia\'s articles.');
  articles.reverse();
  let newPosts = false;
  try {
    const lastArticleID = fs.readFileSync('./opindia.mohini', { encoding: 'utf-8' }).toString();
    const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
    if (lastArticleID === articles[ articles.length - 1 ].articleID) {
      newPosts = false;
    } else if (lastArticleIDIndex !== -1) {
      newPosts = true;
      fs.writeFileSync('./opindia.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
      articles.splice(0, lastArticleIDIndex + 1);
    } else if (lastArticleIDIndex === -1) {
      newPosts = true;
      fs.writeFileSync('./opindia.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
    }
  } catch(e) {
    newPosts = true;
    if (e.code === 'ENOENT') {
      fs.writeFileSync('./opindia.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
    } else {
      console.error(e);
    }
  }
  if (newPosts) {
    declarative && console.log('🔥 New articles to post from OpIndia!');
    const
      articleTexts = await Promise.all(articles.map(async (article) => await fetchOpIndiaArticle(article.articleLink))),
      articleHashtags = articleTexts.map(articleText => getHashtags(articleText));
      articles.forEach((article, i, array) => array[i] = { ...article, caption: `${ _.truncate(articleTexts[i], { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ') }\n⠀\n${ articleHashtags[i] }\n⠀\nSource: OpIndia` });
    return articles;
  } else {
    declarative && console.log('🥶 No new articles to post from OpIndia!');
    return [];
  }
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

const fetchTheWireArticles = async ({ URL, articleCount, declarative }: { URL: string, articleCount: number, declarative: boolean }) => {
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
  declarative && console.log('✅ Fetched The Wire\'s articles.');
  articles.reverse();
  let newPosts = false;
  try {
    const lastArticleID = fs.readFileSync('./thewire.mohini', { encoding: 'utf-8' }).toString();
    const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
    if (lastArticleID === articles[ articles.length - 1 ].articleID) {
      newPosts = false;
    } else if (lastArticleIDIndex !== -1) {
      newPosts = true;
      fs.writeFileSync('./thewire.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
      articles.splice(0, lastArticleIDIndex + 1);
    } else if (lastArticleIDIndex === -1) {
      newPosts = true;
      fs.writeFileSync('./thewire.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
    }
  } catch(e) {
    newPosts = true;
    if (e.code === 'ENOENT') {
      fs.writeFileSync('./thewire.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
    } else {
      console.error(e);
    }
  }
  if (newPosts) {
    declarative && console.log('🔥 New articles to post from The Wire!');
    const
      articleTexts = await Promise.all(articles.map(async (article) => await fetchTheWireArticle(article.articleLink))),
      articleHashtags = articleTexts.map(articleText => getHashtags(articleText));
      articles.forEach((article, i, array) => array[i] = { ...article, caption: `${ _.truncate(articleTexts[i], { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ') }\n⠀\n${ articleHashtags[i] }\n⠀\nSource: The Wire` });
    return articles;
  } else {
    declarative && console.log('🥶 No new articles to post from The Wire!');
    return [];
  }
};

const fetchSwarajyaArticle = async (URL: string) => {
  const result = await axios.get(URL);
  const $ = cheerio.load(result.data);
  let article = '';
  $('.story-element.story-element-text:not(.story-element-text-summary) > div > p').each((_i, element) => {
    const paragraph = $(element).text();
    if (paragraph !== null) {
      article = article.concat(`\n${ striptags(paragraph) }`);
    }
  });
  if ($('.story-grid-m__smag-img-banner__1sMRD > img').attr('srcset') === undefined) {
    return {
      headerImageURL: `https:${ _.maxBy(srcset.parse($('.story-grid-m__smag-img-banner__1sMRD > a > img').attr('srcset') ?? ''), o => o.width)?.url }`,
      caption: article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`)
    };
  } else {
    return {
      headerImageURL: `https:${ _.maxBy(srcset.parse($('.story-grid-m__smag-img-banner__1sMRD > img').attr('srcset') ?? ''), o => o.width)?.url }`,
      caption: article.substring(1).replace(/‘|’/g, '\'').replace(/“|”/g, `"`)
    };
  }
};

const fetchSwarajyaArticles = async ({ URL, articleCount, declarative }: { URL: string, articleCount: number, declarative: boolean }) => {
  const articles: IArticle[] = [];
  const result = await axios.get(URL);
  const $ = cheerio.load(result.data);
  $('.latest-m__load-more-lt-container__XnqhO > div').each((i, element) => {
    if (i < articleCount) {
      const headerImageURL = '';
      const title = $(element).find('.latest-m__card__3vkwo > .latest-m__card-content__3MfaP > .latest-m__card-headline__7-HCL').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`) ?? '';
      const category = '';
      const articleLink = URL + ($(element).find('.latest-m__card__3vkwo > a').attr('href') ?? '');
      const articleID = articleLink ? kirak32(articleLink) : '0';
      const author = $(element).find('.latest-m__card__3vkwo > .latest-m__card-content__3MfaP > .latest-m__card-author__2sAya').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`) ?? '';
      articles.push({
        headerImageURL,
        title,
        category,
        articleLink,
        articleID,
        author: author === 'Swarajya Staff' ? 'External Sources' : author,
        excerpt: '',
        source: SWARAJYA,
        caption: ''
      });
    }
  });
  declarative && console.log('✅ Fetched Swarajya\'s articles.');
  articles.reverse();
  let newPosts = false;
  try {
    const lastArticleID = fs.readFileSync('./swarajya.mohini', { encoding: 'utf-8' }).toString();
    const lastArticleIDIndex = articles.findIndex(article => article.articleID === lastArticleID);
    if (lastArticleID === articles[ articles.length - 1 ].articleID) {
      newPosts = false;
    } else if (lastArticleIDIndex !== -1) {
      newPosts = true;
      fs.writeFileSync('./swarajya.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
      articles.splice(0, lastArticleIDIndex + 1);
    } else if (lastArticleIDIndex === -1) {
      newPosts = true;
      fs.writeFileSync('./swarajya.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
    }
  } catch(e) {
    newPosts = true;
    if (e.code === 'ENOENT') {
      fs.writeFileSync('./swarajya.mohini', articles[ articles.length - 1 ].articleID, { encoding: 'utf-8' });
    } else {
      console.error(e);
    }
  }
  if (newPosts) {
    declarative && console.log('🔥 New articles to post from Swarajya!');
    const
      articleTextsAndHeaderImageURLs = await Promise.all(articles.map(async (article) => await fetchSwarajyaArticle(article.articleLink))),
      articleHashtags = articleTextsAndHeaderImageURLs.map(articleTextsAndHeaderImageURL => getHashtags(articleTextsAndHeaderImageURL.caption));
      articles.forEach((article, i, array) => array[i] = { ...article, headerImageURL: articleTextsAndHeaderImageURLs[i].headerImageURL, caption: `${ _.truncate(articleTextsAndHeaderImageURLs[i].caption, { length: 1900 - articleHashtags[i].length }).replace(/(?:\r\n|\r|\n)/g, '\n⠀\n').replace(/&nbsp;/g, ' ') }\n⠀\n${ articleHashtags[i] }\n⠀\nSource: Swarajya Magazine` });
    return articles;
  } else {
    declarative && console.log('🥶 No new articles to postfrom Swarajya!');
    return [];
  }
};

const createPost = async (headerImageURL: string, title: string, excerpt: string, index: number) => {
  const image = new Jimp(1000, 1000, '#FFFFFF');
  const headerImage = (await Jimp.read(headerImageURL)).cover(1000, 500);
  const logo = (await Jimp.read('./assets/logo/thewiredwatermark.jpg')).resize(125, 50);
  let computedHeight = 0;
  const randomIndex = Math.floor(Math.random() * 3);
  if (randomIndex === 0) {
    const titleFont = await Jimp.loadFont('./assets/fonts/josefin-sans-48-black-bold/josefin-sans-48-black-bold.fnt');
    const excerptFont = await Jimp.loadFont('./assets/fonts/josefin-sans-40-black-light/josefin-sans-40-black-light.fnt');

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
  } else if (randomIndex === 1) {
    const smallTitleFont = await Jimp.loadFont('./assets/fonts/roboto-48-black-bold/roboto-48-black-bold.fnt');
    const largeTitleFont = await Jimp.loadFont('./assets/fonts/roboto-64-black-bold/roboto-64-black-bold.fnt');
    const excerptFont = await Jimp.loadFont('./assets/fonts/roboto-32-black-regular/roboto-32-black-regular.fnt');
    let titleFont: Font = smallTitleFont;
    
    // Add header image.
    image.composite(headerImage, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacityDest: 1,
      opacitySource: 1
    });
    computedHeight = computedHeight + headerImage.getHeight();

    // Add logo.
    image.composite(logo, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacityDest: 1,
      opacitySource: 1
    });

    // Calculate theoretical height with small title.
    const totalHeight = 500 + (30 + Jimp.measureTextHeight(smallTitleFont, title, 1000 - 50 - 50)) + (30 + 10) + (50 + Jimp.measureTextHeight(excerptFont, excerpt, 1000 - 50 - 50) + 50);
    if (totalHeight <= 900) {
      // Use large title.
      titleFont = largeTitleFont;
    } else {
      // Use small title.
      titleFont = smallTitleFont;
    }

    // Print title.
    const titleHeight = Jimp.measureTextHeight(titleFont, title, 1000 - 50 - 50);
    image.print(titleFont, 50, headerImage.getHeight() + 30, {
      text: title,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
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
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, 1000 - 50 - 50, 1000 - computedHeight);
    computedHeight = 1000;
  } else if (randomIndex === 2) {
    const smallTitleFont = await Jimp.loadFont('./assets/fonts/roboto-48-black-bold/roboto-48-black-bold.fnt');
    const largeTitleFont = await Jimp.loadFont('./assets/fonts/roboto-64-black-bold/roboto-64-black-bold.fnt');
    const excerptFont = await Jimp.loadFont('./assets/fonts/roboto-32-black-regular/roboto-32-black-regular.fnt');
    let titleFont: Font = smallTitleFont;

    // Add header image.
    image.composite(headerImage, 0, 500, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacityDest: 1,
      opacitySource: 1
    });

    // Draw left border.
    image.scan(0, 0, 10, 1000, function (_x, _y, offset) {
      this.bitmap.data.writeUInt32BE(0xBD000AFF, offset);
    });

    // Add logo.
    image.composite(logo, 875, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacityDest: 1,
      opacitySource: 1
    });

    // Calculate theoretical height with small title.
    const totalHeight = (75 + Jimp.measureTextHeight(smallTitleFont, title, 1000 - 50 - 50)) + (25 + Jimp.measureTextHeight(excerptFont, excerpt, 1000 - 50 - 50) + 50);
    if (totalHeight <= 420) {
      // Use large title.
      titleFont = largeTitleFont;
    } else {
      // Use small title.
      titleFont = smallTitleFont;
    }

    // Print title.
    const titleHeight = Jimp.measureTextHeight(titleFont, title, 1000 - 50 - 50);
    image.print(titleFont, 50, 75, {
      text: title,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, 1000 - 50 - 50, titleHeight);
    computedHeight = computedHeight + titleHeight + 75;

    // Print excerpt.
    image.print(excerptFont, 50, computedHeight + 25, {
      text: excerpt,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, 1000 - 50 - 50, 500 - computedHeight - 25 - 50);
  }
  image.write(`./assets/output/posts/${ index }.jpg`);
  return;
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
};

const checkAndPublish = async (ig: IgApiClient, declarative: boolean) => {
  const
    opIndiaArticles = await fetchOpIndiaArticles({ URL: OPINDIA_FEED, articleCount: 4, declarative }),
    theWireArticles = await fetchTheWireArticles({ URL: THEWIRE_EDITORS_PICK, articleCount: 3, declarative }),
    swarajyaArticles = await fetchSwarajyaArticles({ URL: SWARAJYA_FEED, articleCount: 3, declarative });
  const articles = knuthShuffle<IArticle>(opIndiaArticles.concat(theWireArticles).concat(swarajyaArticles));
  if (articles.length === 0) {
    declarative && console.log('🥶 No new articles to post!');
    return;
  }
  for (const [ i, article ] of articles.entries()) {
    if (article.source === THEWIRE) {
      const result = await axios.get(article.articleLink);
      const $ = cheerio.load(result.data);
      article.excerpt = $('.shortDesc').text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
    } else if (article.source === SWARAJYA) {
      const result = await axios.get(article.articleLink);
      const $ = cheerio.load(result.data);
      const excerpt = $('.story-element.story-element-text.story-element-text-summary > div > p').first().text().replace(/‘|’/g, '\'').replace(/“|”/g, `"`);
      if (excerpt === '') {
        article.excerpt = _.truncate(article.caption, { length: 100 });
      } else {
        article.excerpt = excerpt;
      }
    }
    declarative && console.log(`🌺 Posting ${ article.articleID } as a photo...`);
    await createPost(article.headerImageURL, article.title.trim(), article.excerpt.trim(), i);
    await sleep(Math.round(Math.random() * 4000) + 1000);
    const uploadId = Date.now().toString();
    await ig.upload.photo({
      file: fs.readFileSync(`./assets/output/posts/${ i }.jpg`),
      uploadId
    });
    declarative && console.log('✅ Posted!');
    declarative && console.log('🌺 Adding caption...');
    const configureOptions: MediaConfigureTimelineOptions = {
      upload_id: uploadId,
      width: 1000,
      height: 1000,
      caption: article.caption
    };
    await ig.media.checkOffensiveComment(article.caption);
    const configureResult = await ig.media.configure(configureOptions);
    if (configureResult.media.caption === null) {
      declarative && console.log(`⌚ Caption could not be added to ${ article.articleID }! Waiting 5 minutes..`);
      const captionFillInterval = setInterval(async () => {
        if ((await ig.media.configure(configureOptions)).media.caption !== null) {
          declarative && console.log(`✅ Caption added to ${ article.articleID }!`);
          clearInterval(captionFillInterval);
        } else {
          declarative && console.log(`⌚ Caption could not be added to ${ article.articleID }! Waiting 5 minutes..`);
        }
      }, 5 * MINUTE);
    } else {
      declarative && console.log('✅ Caption added!');
    }
    declarative && console.log('⌚ Waiting 30 seconds to 1 minute to avoid ban...');
    await sleep(Math.round(Math.random() * 30000) + 30000);
    declarative && console.log(`🌺 Posting ${ article.articleID } as a story...`);
    await createStory(article.headerImageURL, article.title.trim(), i);
    await sleep(Math.round(Math.random() * 4000) + 1000);
    await ig.publish.story({
      file: fs.readFileSync(`./assets/output/story/${ i }.jpg`)
    });
    declarative && console.log('✅ Posted!');
    declarative && console.log('⌚ Waiting 2 to 5 minutes to avoid ban...');
    await sleep(Math.round(Math.random() * 3 * MINUTE) + 2 * MINUTE);
  }
  declarative && console.log('✅ All articles were posted!');
};

const engine = async ({ declarative }: { declarative: boolean }) => {
  declarative && console.log('🌺 Initializing Mohini...');
  const ig = new IgApiClient();
  ig.state.generateDevice(IG_USERNAME);
  declarative && console.log('✅ Generated new device.');
  declarative && console.log('🌺 Logging in...');
  await ig.simulate.preLoginFlow();
  const loggedInUser = await ig.account.login(IG_USERNAME, IG_PASSWORD);
  process.nextTick(async () => await ig.simulate.postLoginFlow());
  declarative && console.log('✅ Logged in to account.');

  // First run.
  declarative && console.log('🌺 Checking for new articles...');
  await checkAndPublish(ig, declarative);
  declarative && console.log('⌚ Checking in after 45 minutes!');

  setInterval(async () => {
    declarative && console.log('🌺 Checking for new articles...');
    await checkAndPublish(ig, declarative);
    declarative && console.log('⌚ Checking in after 45 minutes!');
  }, 45 * MINUTE);

  // Follow new users (5 of n).
  setInterval(async () => {
    declarative && console.log('🌺 Following 50 users...');
    const
      followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId),
      followers = await getAllItemsFromFeed(followersFeed),
      followCount = followers.length,
      targetIndexes = [];
    while (targetIndexes.length < 5) {
      const r = Math.floor(Math.random() * followCount);
      if (targetIndexes.indexOf(r) === -1) targetIndexes.push(r);
    }
    for (const targetIndex of targetIndexes) {
      const
        followerFollowersFeed = ig.feed.accountFollowers(followers[ targetIndex ].pk),
        followerFollowers = await followerFollowersFeed.items(),
        subTargetIndexes = [];
      if (followerFollowers.length > 0) {
        while (subTargetIndexes.length < 5) {
          const r = Math.floor(Math.random() * followerFollowers.length);
          if (subTargetIndexes.indexOf(r) === -1) subTargetIndexes.push(r);
        }
        for (const subTargetIndex of subTargetIndexes) {
          ig.friendship.create(followerFollowers[ subTargetIndex ].pk);
          const time = Math.round(Math.random() * 1000) + 1000;
          await sleep(time);
        }
        const time = Math.round(Math.random() * 9000) + 1000;
        await sleep(time);
      } else {
        continue;
      }
    }
    declarative && console.log('✅ 50 users followed!');
  }, 3.3 * HOUR);

  // Unfollow users.
  setInterval(async () => {
    declarative && console.log('🌺 Unfollowing 50 users...');
    const
      followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId),
      followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId),
      followers = await getAllItemsFromFeed(followersFeed),
      following = await getAllItemsFromFeed(followingFeed),
      followersUsername = new Set(followers.map(({ username }) => username)),
      notFollowingYou = following.filter(({ username }) => !followersUsername.has(username));
    for (const [ i, user ] of notFollowingYou.entries()) {
      if (i <= 49) {
        await ig.friendship.destroy(user.pk);
        const time = Math.round(Math.random() * 9000) + 1000;
        await sleep(time);
      } else {
        break;
      }
    }
    declarative && console.log('✅ 50 users unfollowed!');
  }, 4 * HOUR);

  // Cannibalize stories >6 hours.
  setInterval(async () => {
    declarative && console.log('🌺 Deleting old stories...');
    const
      storiesFeed = ig.feed.userStory(loggedInUser.pk),
      stories = await getAllItemsFromFeed(storiesFeed);
    for (const story of stories) {
      if ( (((Date.now() / 1000) - story.taken_at) / 60 / 60) > 6 ) {
        await ig.media.delete({ mediaId: story.id });
        const time = Math.round(Math.random() * 9000) + 1000;
        await sleep(time);
      }
    }
    declarative && console.log('✅ Old stories deleted!');
  }, 2.5 * HOUR);

  // Post promotional material.
  setInterval(async () => {
    const date = new Date(), hour = date.getHours();
    if (hour === 12) {
      await ig.publish.photo({
        file: fs.readFileSync(`./assets/advert/0.jpg`),
        caption: `If West Taiwan tries to suppress free press, they're also suppressing our freedom of speech.\n⠀\nTogether we can prevent that from happening.`
      });
    } else if (hour === 15) {
      await ig.publish.photo({
        file: fs.readFileSync(`./assets/advert/1.jpg`),
        caption: `We have the right to free speech.\n⠀\nBut those in power (in China) are trying to suppress it.\n⠀\nTogether we can prevent that from happening.\n⠀\nWill you help us?`
      });
    } else if (hour === 18) {
      await ig.publish.photo({
        file: fs.readFileSync(`./assets/advert/2.jpg`),
        caption: `Suppressing the voices of journalists in West Taiwan won't suppress the truth.\n⠀\nLet's raise our voice together and speak truth to power.`
      });
    } else if (hour === 21) {
      await ig.publish.photo({
        file: fs.readFileSync(`./assets/advert/3.jpg`),
        caption: `Stand with us while we hold power accountable and keep democracy alive in West Taiwan and in the West Indian Province of Pakistan.`
      });
    }
  }, 1 * HOUR);
};

engine({ declarative: true });
