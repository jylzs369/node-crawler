const fs = require('fs')
const Koa = require('koa')
const request = require('superagent')
const cheerio = require("cheerio")
const targets = require('./targets/psycology')
const app = new Koa()

const exportDir = './exports/psycology_question.json'

// 抓取心理学问题数据
const fetchPsycologyQuestionr = function (ctx) {
  let data = {}
  let queryPromises = []
  targets.forEach((target, index) => {
    queryPromises[index] = new Promise((resolve, reject) => {
      request
        .get(target.questionUrl)
        .then(res => {
          domAction(res.text, target, data, resolve)
        })
        .catch(err => reject(err))
    })
  })
  Promise.allSettled(queryPromises).then(() => {
    fs.writeFileSync(exportDir, JSON.stringify(data))
    ctx.body = data
  }).catch(err => {
    console.log(err)
  })
}

// 抓取心理学答案数据
const fetchPsycologyAnswer = function (ctx) {

}

// 处理DOM
const domAction = function (result, target, data, resolve) {
  const $ = cheerio.load(result)
  const $singles = $('#divCut1').nextUntil('#divCut2')
  const $multiples = $('#divCut2').nextAll('.div_question').slice(0, -1)
  let subject = target.subject
  let singles = []
  let multiples = []
  formatData($, $singles, singles)
  formatData($, $multiples, multiples)
  data[subject] = { subject, singles, multiples }
  resolve(true)
}

// 格式化数据
function formatData ($, $el, arr) {
  $el.each((index, el) => {
    let title = $(el).find('.div_title_question').children()[0].prev.data.replace(/^\d+\.\s?/, '').trim()
    let answers = $(el).find('.ulradiocheck').children('li').map((i, el) => $(el).text()).get()
    arr[index]= { title, answers }
  })
}



app.use(async ctx => {
  const fileExist = fs.existsSync(exportDir)
  if (!fileExist) {
    fetchPsycologyQuestion(ctx)
  } else {
    data = fs.readFileSync(exportDir)
    ctx.body = JSON.parse(data)
  }
}).listen(7777)
