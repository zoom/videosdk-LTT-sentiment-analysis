# Video SDK Web - Sentiment Analysis

Use of this sample app is subject to our [Terms of Use](https://explore.zoom.us/en/video-sdk-terms/).

The [Zoom Video SDK for web](https://developers.zoom.us/docs/video-sdk/web/) enables you to build custom video experiences on a webpage with Zoom's core technology. This demo showcases how to use a [media processor](https://developers.zoom.us/docs/video-sdk/web/raw-data) to display closed captions on user video and screenshare. It uses the Video SDK [Live transcription](https://developers.zoom.us/docs/video-sdk/web/transcription-translation/) feature.

## Installation
To get started, clone the repo:

`git clone https://github.com/zoom/videosdk-LTT-sentiment-analysis.git`


## Quick Deploy

| Render |
|:-:|
| [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zoom/videosdk-LTT-sentiment-analysis)

## JWT Helper

The project provides a `generateToken.ts` file that can be used to generate a temporary JWT:
1. Create a `.env` file in the root directory of the project, you can do this by copying the `.env.example` file (`cp .env.example .env`) and replacing the values with your own. The `.env` file should look like this:

```
ZOOM_SDK_KEY=abc123XXXXXXXXXX
ZOOM_SDK_SECRET=abc123XXXXXXXXXX
```

2. Run `bun generateToken.ts TestOne --copy-to-clipboard`

The script generates a token for the proivded session name and the `--copy-to-clipboard` or `-c` flag copies it to your clipboard.

1. Run the app:

   `npm run dev`

## Usage

1. Navigate to http://localhost:5173

1. Click "Join" to join the session

1. As you speak, you'll see closed captions displayed on your video and screenshare.

For the full list of features and event listeners, as well as additional guides, see our [Video SDK docs](https://developers.zoom.us/docs/video-sdk/web/).

## Need help?

If you're looking for help, try [Developer Support](https://devsupport.zoom.us) or our [Developer Forum](https://devforum.zoom.us). Priority support is also available with [Premier Developer Support](https://explore.zoom.us/docs/en-us/developer-support-plans.html) plans.

## Disclaimer

Do not expose your credentials to the client, when using the Video SDK in production please make sure to use a backend service to sign the tokens. Don't store credentials in plain text, as this is a sample app we're using an `.env` for sake of simplicity.
