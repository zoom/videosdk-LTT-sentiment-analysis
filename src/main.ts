import ZoomVideo, { event_peer_video_state_change, LiveTranscriptionLanguage, Processor, VideoPlayer, VideoQuality } from "@zoom/videosdk";
import { getBitmap } from "./utils";
import "./style.css";
import * as tf from '@tensorflow/tfjs';

const videoContainer = document.querySelector('video-player-container') as HTMLElement;
const sessionName = "TestSession";
const username = `User-${String(new Date().getTime()).slice(6)}`;

let videoprocessor: Processor;
var sentimentWorker: any = null;
var processingPaused = false;

const client = ZoomVideo.createClient();
await client.init("en-US", "Global", { patchJsMedia: false, });

// UI Logic
const startBtn = document.querySelector("#start-btn") as HTMLButtonElement;
const stopBtn = document.querySelector("#stop-btn") as HTMLButtonElement;
const aiform = document.querySelector("#ai-form") as HTMLDivElement;
const videoSection = document.querySelector("#video-section") as HTMLElement;
const aiBtn = document.querySelector("#ai-btn") as HTMLButtonElement;
const sampleSize = document.getElementById('sample-size') as HTMLInputElement; 
const epochs = document.getElementById('epochs') as HTMLInputElement;
const sampleSizeOutput = document.getElementById('sample-size-output') as HTMLElement; 
const epochsOutput = document.getElementById('epochs-output') as HTMLElement;
const sentimentOutput = document.getElementById('sentiment') as HTMLElement;


const startCall = async () => {

    let endpointUrl: string | null = null;
    try {
        const configResponse = await fetch("/config");
        if (configResponse.ok) {
            const config = await configResponse.json();
            endpointUrl = config.endpointUrl ?? null;
        }
    } catch (error) {
        console.error("Failed to retrieve server config:", error);
    }

    let token: string | null = null;

    if (endpointUrl) {
        try {
            const response = await fetch(`${endpointUrl}/zoomtoken?session=${encodeURIComponent(sessionName)}`);
            if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
            const data = await response.json();
            token = data.token ?? null;
        } catch (error) {
            console.error("Failed to retrieve token from server:", error);
            alert("Failed to retrieve token from the token server. Please check the server and try again.");
        }
    } else {
        token = prompt("Please enter your JWT Token:");
    }

    client.on("peer-video-state-change", renderVideo);

    if (token) {
        await client.join(sessionName, token, username);
        const mediaStream = client.getMediaStream();
        if (!mediaStream.isSupportVideoProcessor()) alert("Your browser does not support video processor");
        await mediaStream.startAudio();
        await mediaStream.startVideo();
        
        // render the video of the current user
        await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });

        videoprocessor = await mediaStream.createProcessor({
            name: "caption",
            type: "video",
            url: window.location.origin + "/caption-video.js",
        });
        await mediaStream.addProcessor(videoprocessor);

        client.on("caption-message", async (payload) => {
            if (payload.done && !processingPaused) runSentiment(payload.text);

            if (payload.userId === client.getCurrentUserInfo().userId) {
                const { width, height } = mediaStream.getCapturedVideoResolution();
                const videoImageBitmap = await getBitmap(payload.text, width, height);
                videoprocessor.port.postMessage({ cmd: 'caption', image: videoImageBitmap })
                }
        });
        const liveTranscriptionTranslation = client.getLiveTranscriptionClient();
        await liveTranscriptionTranslation.startLiveTranscription();
        liveTranscriptionTranslation.setSpeakingLanguage(LiveTranscriptionLanguage.English);

        await launchAI();

        startBtn.innerHTML = "Connected";
        startBtn.style.display = "none";
        aiform.style.display = "flex";
        videoSection.style.display = "block";

        sampleSize.oninput = () => {
            sampleSizeOutput.innerHTML = `Training Sample Size: ${sampleSize.value}`;
        };
        epochs.oninput = () => {
            epochsOutput.innerHTML = `Epochs: ${epochs.value}`;
        };
    } else {
        alert("Token needed to join Session");
        startBtn.innerHTML = "Join";
        startBtn.disabled = false;
    }
};

const renderVideo: typeof event_peer_video_state_change = async (event) => {
    const mediaStream = client.getMediaStream();
    if (event.action === 'Stop') {
        const element = await mediaStream.detachVideo(event.userId);
        if (Array.isArray(element))
            element.forEach((el) => el.remove())
        else if (element) element.remove();
    } else {
        const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_720P);
        videoContainer.appendChild(userVideo as VideoPlayer);
    }
};

const leaveCall = async () => {
    const mediaStream = client.getMediaStream();
    await mediaStream.removeProcessor(videoprocessor).catch(e => console.log(e));
    for (const user of client.getAllUser()) {
        const element = await mediaStream.detachVideo(user.userId);
        if (Array.isArray(element))
            element.forEach((el) => el.remove())
        else if (element) element.remove();
    }
    client.off("peer-video-state-change", renderVideo);
    await client.leave();
}

const launchAI = async () => {
    sentimentWorker = new Worker(window.location.origin + "/transcript-sentiment.js");
    sentimentWorker.onmessage = (e: any) => {
        const {event, payload: {allWords, wordReference, result}} = e.data;
        switch(event) {
            case 'model-inited':
                localStorage.setItem("allWords", allWords);
                localStorage.setItem("wordReference", wordReference);
                processingPaused = false;
                aiBtn.innerHTML = 'Reset AI';
                aiBtn.disabled = false;
                break;
            case 'sentiment-result':
                sentimentOutput.innerHTML = `Detected Sentiment: ${result}`;
        }
    }
};
    
const runSentiment = (transcript: any) => {
    if (!sentimentWorker) {
        alert("click 'Launch AI' to initialize Model first");
        return;
    }

    const allWords = localStorage.getItem("allWords");
    const wordReference = localStorage.getItem("wordReference");

    if (!allWords || !wordReference) {
        console.log("Vocabulary list not found in local storage. Retraining model...");
        sentimentWorker.postMessage({
            event: 'train-model',
            payload: { sampleSize: 250, epochs: 50 }
        });
        return;
    }  

    sentimentWorker.postMessage({
            event: 'run-detection',
            payload: { allWords, wordReference, transcript }
    });
};

startBtn.addEventListener("click", async () => {
    startBtn.innerHTML = "Connecting...";
    startBtn.disabled = true;
    await startCall();
    
});

stopBtn.addEventListener("click", async () => {
    await leaveCall();
    startBtn.style.display = "block";
    startBtn.innerHTML = "Join";
    startBtn.disabled = false;
    aiform.style.display = "none";
    videoSection.style.display = "none";
});

aiBtn.addEventListener("click", async () => {
    try {
        await tf.io.removeModel("indexeddb://audiotranscript-sentiment");
        console.log(`Model 'audiotranscript-sentiment' successfully removed from IndexedDB.`);
    } catch (error) {
        console.error({error});
    }

    processingPaused = true;
    aiBtn.innerHTML = 'training model...';
    aiBtn.disabled = true;
    
    sentimentWorker.postMessage({
        event: 'train-model',
        payload: { sampleSize: parseInt(sampleSize.value), epochs: parseInt(epochs.value) }
    });
});
