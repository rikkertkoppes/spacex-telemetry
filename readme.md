#SpaceX telemetry capturing

An attempt to capture telemetry in realtime from a live video stream

- uses electron js to be able to do desktop capturing
- uses a very crude image overlap calculation to recognize characters

It is not much yet, but it does give some results:

![example.png](example.png)

## getting it to run

- clone from github
- `npm install`
- `npm start`

## workings

- play the spacex video in a frame, with a bit of transforms to get the interesting part up close
- use electron to capture the window and feed it back into a video element
- capture that video element to a few canvas elements, slicing out the data bits
- some thresholding to get the individual characters in greyscale
- calculate the similarity with predefined characters and get the best
- use that to guess the character

## improvements / plans

- put the results on a websocket message bus
- better character segmentation (it is currently not properly segmented when the video resolution is low)
- better character recognition, we may use a somewhat smarter algorithm, but it needs to be fast.
- more user friendly ui.