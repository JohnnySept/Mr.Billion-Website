const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)});
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

async function callGemini(model, apiKey, prompt) {
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.65,maxOutputTokens:1800}})});
  let data={};
  try { data=await response.json(); } catch {}
  return {response,data,model};
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Use POST.'});
  try{
    if(!process.env.GEMINI_API_KEY)return json(500,{error:'Missing GEMINI_API_KEY. Add it in Netlify environment variables with Functions scope, then redeploy.'});
    let body={};try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON request.'})}
    const videoId=String(body.videoId||'');const title=String(body.title||'').slice(0,300);const description=String(body.description||'').slice(0,5000);
    if(!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)||!title)return json(400,{error:'A valid videoId and title are required.'});

    const primary=(process.env.GEMINI_MODEL||'gemini-2.5-flash').replace(/^models\//,'');
    // The fallback is a current lightweight model; it helps if the configured model is temporarily overloaded.
    const models=[primary];
    const fallback=(process.env.GEMINI_FALLBACK_MODEL||'gemini-3.5-flash-lite').replace(/^models\//,'');
    if(fallback!==primary)models.push(fallback);
    const prompt=`You are the editorial writer for MR.BILLION, a creator site. Write a useful, engaging article inspired by a YouTube video. Be transparent about evidence: you only have the title and description, not the actual video transcript or visuals. Do not claim to have watched the video, invent details, quote people, or present uncertain claims as facts. If the topic makes factual claims, explain what can be established from the supplied context and flag what needs verification. Use Markdown with: a strong title, short intro, 3-5 informative sections, practical takeaways, and a short “What to verify” section if needed. Avoid generic filler. Keep it around 500-800 words. Video title: ${title}\nVideo URL: https://www.youtube.com/watch?v=${videoId}\nDescription: ${description||'(No description provided)'}`;

    let lastStatus=502,lastMessage='Gemini request failed.';
    for(let i=0;i<models.length;i++){
      const model=models[i];
      // One retry for transient overload on the primary model, with a short backoff to fit typical function limits.
      const attempts=(i===0?2:1);
      for(let attempt=0;attempt<attempts;attempt++){
        let result;
        try { result=await callGemini(model,process.env.GEMINI_API_KEY,prompt); }
        catch(e) {
          lastStatus=502;lastMessage='Could not connect to Gemini. Please try again.';
          console.error(`Gemini network error (${model}):`,e.message||e);
          if(attempt+1<attempts){await sleep(900);continue;}
          break;
        }
        const {response,data}=result;
        if(response.ok){
          const article=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||'').join('\n').trim();
          if(!article)return json(502,{error:'Gemini returned an empty article. Please try again.'});
          return json(200,{article,model,videoId});
        }
        lastStatus=response.status;lastMessage=data.error?.message||`Gemini API request failed (${response.status}).`;
        console.error(`Gemini API error (${model}):`,response.status,JSON.stringify(data).slice(0,1200));
        const transient=[408,429,500,502,503,504].includes(response.status);
        if(!transient) return json(response.status===400||response.status===401||response.status===403||response.status===404?response.status:502,{error:`Gemini rejected the request (${response.status}). Check the API key, model name and API access. Details: ${lastMessage}`});
        if(attempt+1<attempts){await sleep(1000);continue;}
        // If primary model is overloaded, try the fallback model once.
        break;
      }
    }
    if(lastStatus===503||lastStatus===502||lastStatus===500||lastStatus===504){
      return json(503,{error:'Gemini is temporarily overloaded, including the fallback model. Please wait 30–60 seconds and try again.'});
    }
    if(lastStatus===429)return json(429,{error:'Gemini rate limit or quota reached. Wait for the quota window to reset, or check your Google AI Studio quota.'});
    return json(502,{error:`Could not generate the article. ${lastMessage}`});
  }catch(e){console.error('Article generation failed:',e);return json(500,{error:e.message||'Article generation failed.'});}
};
