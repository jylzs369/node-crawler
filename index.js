const fs = require('fs')
const Koa = require('koa')
const request = require('superagent')
const cheerio = require("cheerio")
const psycology = require('./targets/psycology')
const app = new Koa()

const exportDirQuestion = './exports/psycology_question.json'
const exportDirAnswer = './exports/psycology_answer.json'

// 抓取心理学问题数据
const fetchPsycology = function (type, exportDir) {
  let data = { question: {}, answer: {} }
  let queryPromises = []
  psycology.targets.forEach((target, index) => {
    let url = target[`${type}Url`]
    if (url) {
      queryPromises[index] = new Promise((resolve, reject) => {
        if (type === 'question') {
          request.get(url).then(res =>  domAction(type, res.text, target, data[type], resolve)).catch(err => reject(err))
        } else {
          request.post(url).type('form').send(target.params)
            .then(res => domAction(type, res.text, target, data[type], resolve)).catch(err => reject(err))
        }
      })
    }
  })
  Promise.allSettled(queryPromises).then(() => {
    fs.writeFileSync(exportDir, JSON.stringify(data[type]))
  }).catch(err => {
    console.log(err)
  })
}

// 处理DOM
const domAction = function (type, result, target, data, resolve) {
  const $ = cheerio.load(result)
  let id = target.id
  let subject = target.subject
  let singles = []
  let multiples = []
  if (type === 'question') {
    const $singles = $('#divCut1').nextUntil('#divCut2')
    const $multiples = $('#divCut2').nextAll('.div_question').slice(0, -1)
    formatQuestionData($, $singles, singles, 'single')
    formatQuestionData($, $multiples, multiples, 'multiple')
    data[subject] = { id, subject, singles, multiples }
  } else {
    const $singles = $('#divAnswer').find('.data__section').eq(0).nextUntil('.data__section')
    const $multiples = $('#divAnswer').find('.data__section').eq(1).nextAll('.data__items').slice(0, -1)
    formatAnswerData($, $singles, singles, 'single')
    formatAnswerData($, $multiples, multiples, 'multiple')
    data[subject] = { id, subject, singles, multiples }
  }
  resolve(true)
}

// 格式化数据
function formatQuestionData ($, $el, arr, type) {
  $el.each((index, el) => {
    let title = $(el).find('.div_title_question').children()[0].prev.data.replace(/^\d+\.\s?/, '').trim()
    let answers = $(el).find('.ulradiocheck').children('li').map((i, el) => $(el).text()).get()
    arr[index]= { type, title, answers }
  })
}

function formatAnswerData ($, $el, arr, type) {
  $el.each((index, el) => {
    let title = $(el).find('.data__tit').children()[0].prev.data.replace(/^\d+\.\s?/, '').trim();
    let correctAnswer = type === 'single' ? '' : [];
    if (type === 'single') {
      let $imgs = $(el).find('.data__key').find('img');
      if ($imgs.attr('alt') === '正确') {
        correctAnswer = $imgs[0].prev.data.match(/[A-Z]/)[0];
      } else {
        correctAnswer = $imgs.next().next()[0].next.data.match(/[A-Z]/)[0];
      }
    } else {
      let $imgs = $(el).find('.data__key').find('img');
      if ($imgs.attr('alt') === '正确') {
        correctAnswer = $imgs[0].prev.data.match(/[A-Z]/g);
      } else {
        correctAnswer = $imgs.next().next()[0].next.data.match(/[A-Z]/g);
      }
    }
    arr[index]= { type, title, correctAnswer }
  })
}

app.use(async ctx => {
  const fileExist = fs.existsSync(exportDirQuestion) && fs.existsSync(exportDirAnswer)
  if (!fileExist) {
    fetchPsycology('question', exportDirQuestion)
    fetchPsycology('answer', exportDirAnswer)
    ctx.body = 'success'
  } else {
    ctx.body = '文档已存在'
  }
}).listen(7777)
