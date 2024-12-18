import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
import fileUpload from 'express-fileupload';
import { Pinecone } from '@pinecone-database/pinecone'
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "Vpv1YgvVd6CHIzOTiTt8";

const app = express();
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(fileUpload());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  console.log("LYPSYNC MESSAGE!!!")
  console.log("MESSAGE: ", message)
  const time = new Date().getTime();
  console.log(`Starting conversion mp3 to wav for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  console.log("Starting LypSync -> wav to json data")
  await execCommand(
    `bin\\rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  );
  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};


const lipSyncAudio = async (audioFilePath) => {
  const time = new Date().getTime();
  console.log(`Starting conversion mp3 to wav for ${audioFilePath}`);
  await execCommand(
    `ffmpeg -y -i ${audioFilePath} ${audioFilePath.replace('.wav', '.mp3')}`
  );

  console.log(`Conversion done in ${new Date().getTime() - time}ms`);

  console.log("Starting LipSync -> wav to json data");
  await execCommand(
    `bin\\rhubarb -f json -o ${audioFilePath.replace('.wav', '.json')} ${audioFilePath} -r phonetic`
  );
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};


app.post("/process-audio", async (req, res) => {
  console.log("PROCESS AUDIO!!!!!!!!!!!!!!!!!!!!!!!!!!")
  const audioFile = req.files.audio; 

  const audioFilePath = `audios/recorded_audio.wav`;
  await audioFile.mv(audioFilePath);  

  await lipSyncAudio(audioFilePath);

  const messages = [
    {
      text: "Here is your response...",
      audio: await audioFileToBase64(audioFilePath),
      lipsync: await readJsonTranscript(audioFilePath.replace('.wav', '.json')),
      facialExpression: "smile",
      animation: "Talking_1",
    },
  ];

  res.send({ messages });
});


app.post("/getKnowledgeBase", async (req, res) => {
  const query = req.body.query;
  console.log("get KnowledgeBase!!!!!!!!!!!!!!!!!!!!!!!!!!")
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, 
    dangerouslyAllowBrowser: true
  });


  let embeddingVector;

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  });

  embeddingVector = embeddingResponse.data[0].embedding;

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  let queryResponse;

  const index = pc.index("tecsup");

  queryResponse = await index.namespace("2600-Chancado-Primario").query({
    topK: 3,
    vector: embeddingVector,
    includeMetadata: true,
  });

  console.log("CHUNKS: ", queryResponse);

  res.send({ queryResponse });
});



app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Talking_1",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are a male virtual mining assistant.
        You will always reply with a JSON array of messages. With a maximum of 3 messages.
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking_1, Talking_2, Talking_3, Yelling, Idle and Waving. 
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  let messages = JSON.parse(completion.choices[0].message.content);

  console.log("messages: ", messages)

  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio file
    const fileName = `audios/message_${i}.mp3`; // The name of your audio file
    const textInput = message.text; // The text you wish to convert to speech
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
    // generate lipsync
    await lipSyncMessage(i);
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
