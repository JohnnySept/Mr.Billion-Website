const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Use POST.'});
  try{
    if(!process.env.GEMINI_API_KEY)return json(500,{error:'Missing GEMINI_API_KEY. Add it in Netlify environment variables with Functions scope, then redeploy.'});
    let body={};try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON request.'})}
    const videoId=String(body.videoId||'');const title=String(body.title||'').slice(0,300);const description=String(body.description||'').slice(0,5000);
    if(!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)||!title)return json(400,{error:'A valid videoId and title are required.'});
    const model=(process.env.GEMINI_MODEL||'gemini-2.5-flash').replace(/^models\//,'');
    const prompt=`You are the editorial writer for MR.BILLION, a creator site. Write a useful, engaging article inspired by a YouTube video. Be transparent about evidence: you only have the title and description, not the actual video transcript or visuals. Do not claim to have watched the video, invent details, quote people, or present uncertain claims as facts. If the topic makes factual claims, explain what can be established from the supplied context and flag what needs verification. Use Markdown with: a strong title, short intro, 3-5 informative sections, practical takeaways, and a short “What to verify” section if needed. Avoid generic filler. Keep it around 500-800 words. Video title: ${title}\nVideo URL: https://www.youtube.com/watch?v=${videoId}\nDescription: ${description||'(No description provided)'}`;
    const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.65,maxOutputTokens:1800}})});
    const data=await response.json();if(!response.ok){console.error('Gemini API error:',response.status,JSON.stringify(data).slice(0,1500));return json(response.status===429?429:502,{error:data.error?.message||`Gemini API request failed (${response.status}). Check the API key, model availability and quota.`});}
    const article=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||'').join('\n').trim();if(!article)return json(502,{error:'Gemini returned an empty article. Check Gemini logs/quota and try again.'});
    return json(200,{article,model,videoId});
  }catch(e){console.error('Article generation failed:',e);return json(500,{error:e.message||'Article generation failed.'});}
};
