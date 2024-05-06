const express = require('express');
const Papa = require('papaparse');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3001;

const answers = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7Vof9xFLdL1bmF_CbnCtwOx3Av53UbHI3H5CQPWrmp7vB5E1iIwWF9-9iw52JrDBCKERNb37gPEzx/pub?gid=1965556597&single=true&output=csv';
const variables = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7Vof9xFLdL1bmF_CbnCtwOx3Av53UbHI3H5CQPWrmp7vB5E1iIwWF9-9iw52JrDBCKERNb37gPEzx/pub?gid=1784760929&single=true&output=csv';
const catSubScore = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7Vof9xFLdL1bmF_CbnCtwOx3Av53UbHI3H5CQPWrmp7vB5E1iIwWF9-9iw52JrDBCKERNb37gPEzx/pub?gid=949569404&single=true&output=csv';
const ptspQuestion = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7Vof9xFLdL1bmF_CbnCtwOx3Av53UbHI3H5CQPWrmp7vB5E1iIwWF9-9iw52JrDBCKERNb37gPEzx/pub?gid=1864463315&single=true&output=csv';

async function getCsvData(csv) {
  const response = await fetch(csv);
  const data = await response.text();
  return Papa.parse(data, { header: true }).data;
}

async function getScore(answer, id, questionData) {
  const matchingData = questionData.find(
    (item) => item.response === answer && id === item.id
  );

  if (matchingData) {
    return matchingData;
  } else {
    console.error(`Score not found for answer: ${answer}`);
    return null;
  }
}

async function processScores(jsonData, scoringData) {
  const subCategoryScores = {};
  const categoryScores = {};

  for (const answer in jsonData) {
    if (
      jsonData.hasOwnProperty(answer) &&
      answer !== 'Submission ID' &&
      answer !== 'company'
    ) {
      const isSingle = scoringData.find(
        (item) => item.response === jsonData[answer] && item.type === 'single'
      );
      const isMultiple = scoringData.find(
        (item) => item.id === answer && item.type === 'multiple'
      );

      if (isMultiple) {
        const score = parseInt(
          JSON.parse(jsonData[answer].toLowerCase()) * isMultiple.score
        );

        const subCategory = isMultiple.subcat;
        const category = isMultiple.category;

        if (!subCategoryScores[subCategory]) {
          subCategoryScores[subCategory] = [];
        }

        if (!categoryScores[category]) {
          categoryScores[category] = [];
        }

        subCategoryScores[subCategory].push(score);
        categoryScores[category].push(score);
      }

      if (isSingle) {
        const scoreData = await getScore(jsonData[answer], answer, scoringData);
        if (scoreData) {
          const subCategory = scoreData.subcat;
          const category = scoreData.category;

          if (!subCategoryScores[subCategory]) {
            subCategoryScores[subCategory] = [];
          }

          if (!categoryScores[category]) {
            categoryScores[category] = [];
          }

          subCategoryScores[subCategory].push(parseInt(scoreData.score));
          categoryScores[category].push(parseInt(scoreData.score));
        }
      }
    }
  }

  const scores = [subCategoryScores, categoryScores];
  return scores;
}

app.get('/score/:id', async (req, res) => {
  const id = req.params.id;
  const answer = await getCsvData(answers);
  const vars = await getCsvData(variables);
  const catSubScores = await getCsvData(catSubScore);
  const ptspQuestions = await getCsvData(ptspQuestion);

  const matchingRow = answer.find((row) => row['Submission ID'] === id);

  if (matchingRow) {
    const scores = await processScores(matchingRow, ptspQuestions);
    const scoresBySubCategory = scores[0];
    const scoresByCategory = scores[1];

    const categoryTotals = {};
    for (const category in scoresByCategory) {
      categoryTotals[category] = scoresByCategory[category].reduce(
        (acc, curr) => acc + curr,
        0
      );
    }

    let overallTotal = 0;
    for (const total in categoryTotals) {
      overallTotal += categoryTotals[total];
    }

    const dataovr = catSubScores.find(
      (item) => item.subCat === 'General' && item.category === 'Overall'
    );
    const scorePercentageOvr = overallTotal / parseInt(dataovr.scoreMaxMax);
    const ovrScore = (scorePercentageOvr * 10).toFixed(1);
    let overallScoreRec = '';

    const to1A = vars[0].valueA;
    const to1B = vars[0].valueB;
    const to1C = vars[0].valueC;

    if (scorePercentageOvr <= to1A) {
      overallScoreRec = dataovr.lowRes;
    } else if (scorePercentageOvr <= to1B) {
      overallScoreRec = dataovr.midRes;
    } else if (scorePercentageOvr <= to1C) {
      overallScoreRec = dataovr.highRes;
    }

    //res.json({ score: ovrScore, recommendation: overallScoreRec });
    
    const responseXml = `<response>
  <html>
    <div> ${ovrScore}</div>
    <div> ${overallScoreRec}</div>
  </html>
</response>`;

    res.set('Content-Type', 'application/xml');
    res.send(responseXml);
  } else {
    res.status(404).json({ error: `No matching ID ${id} found in the data.` });
  }
});
    
    
    
  //} else {
  //  res.status(404).json({ error: `No matching ID ${id} found in the data.` });
 // }
//});

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});

/*
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
*/
