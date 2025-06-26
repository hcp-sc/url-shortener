# WINDOWS IS NOT SUPPORTED
# I DONT KNOW IF WSL WORKS, DONT ASK
# HAS ONLY BEEN TESTED ON MAC AND LINUX
# THERE IS AN UNTESTED WORKAROUND, IF YOU REALLY NEED IT (SEE THE BOTTOM)


# Shorty!

## Config

The configuration is simple. Enviornment Vars:
```
PORT: port to run it on
HOST: the host to run it on
FILENAME: file to store urls at
NOUI: disable the UI, if it is a URL redirect to that page.
REDIRECTURI: uri to redirect to when it is a 404 or NOUI is enabled.
```

## How do i use?

see the demo.mov

https://github.com/user-attachments/assets/b7d55ea0-b11d-4c04-9f7e-b3d497a945bf

## It gives an error :(. Now im sad

The package.json has been updated to automatically do this when you run it.
~~First try running~~
```sh
npm i
```

Ok, but how do i run it?
```
npm start
```
or you can use
```
node index.js
```
If you use the node path to launch, rembember to use `npm i` to install dependencies.

## Shucks :(. it still won't work!

If it gives you an error building fs ext, i just remove node_modules and package-lock and build anew. If it is windows, see the bottom.

If you are the hackclub reviewer, please give me the feedback on there.

Otherwise, make an issue and i will do my best to help!


## i am a loser and i use windows. how do i use?
Well since fs-ext requires linux, just install all the packages except fs-ext.
The command is:
```
npm i better-sqlite3 express multer nanoid.
```