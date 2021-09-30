const http = require('http');
const path = require('path');
const fs = require('fs');
const Koa = require('koa');
const koaBody = require('koa-body');
const koaStatic = require('koa-static');
const Router = require('koa-router');
const WS = require('ws');
const uuid = require('uuid');
const presetPostsArray = require('./preset');
const serverFolder = path.join(__dirname, '../public');
console.log('serverFolder: ', serverFolder);
const app = new Koa();
const router = new Router();

app.use(koaStatic(serverFolder));
app.use(koaBody({
  multipart: true,
  json: true,
}));

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }
  // const headers = { 'Access-Control-Allow-Origin': 'http://localhost:9999'};
  const headers = { 'Access-Control-Allow-Origin': 'https://antis85.github.io'};
  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set(
        'Access-Control-Allow-Headers',
        ctx.request.get('Access-Control-Request-Headers'),
      );
    }

    ctx.response.status = 204;
  }
});

const postList = [...presetPostsArray];

router.get('/:filefolder', async (ctx, next) => {
// console.log('GET_ctx.params: ', ctx.params);
const {filefolder} = ctx.params;
const folderPath = path.join(serverFolder, filefolder, '/'); 
function stat(file) {
    return new Promise(function(resolve, reject) {
      fs.stat(file, function(err, stat) {
        if (err) {
          reject(err);
        } else {
          resolve(stat);
        }
      });
    });
  }
  const filepath = fs.readdirSync(folderPath).map(fileName => {
    return path.join(folderPath, fileName);
  });
  console.log('filepath: ', filepath[0]);
  // console.log('fpath: ', fpath);
  const fstat = await stat(filepath[0]);
  // console.log('fstat: ', fstat);
  if (fstat.isFile()) {
    // ctx.response.type = path.extname(filepath[0]);
    ctx.response.body = fs.createReadStream(filepath[0]);
  }
});

router.post('/', async (ctx, next) => {
 if (!ctx.request.files.file) return;
  const file = ctx.request.files.file;
  const reader = fs.createReadStream(file.path);
  const newFolderName = uuid.v4();
  // console.log('newFolderName: ', newFolderName);
  const newFolderPath = path.join(serverFolder, newFolderName, '/');
  // console.log('newFolderPath: ', newFolderPath);
  fs.mkdir(newFolderPath, (err)=>{
    if (err) {
      console.error(err)
      return
    }
  });
  const newFilePath = newFolderPath+file.name;  
  // console.log('newFilePath: ', newFilePath);
  const stream = fs.createWriteStream(newFilePath);
  reader.pipe(stream);
  console.log('uploading %s -> %s', file.name, stream.path);
  postList.push({
    id: newFolderName,
    timestamp: new Date().getTime(),
    coordinates: {
      latitude: ctx.request.body.lat,
      longitude: ctx.request.body.lng,
    },
    file: {
      url: 'https://ahj-chaos-organizer.herokuapp.com/'+newFolderName+'/'+file.name,
      name: file.name,
      type: ctx.request.body.fileType,
    },
    status: {
      pinned: false,
      favorite: false,
    }
  });
  ctx.response.body = newFolderName;
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7071;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });
let wsClients = [];

wsServer.on('connection', (ws, req) => {
  // console.log('ws connection opened');
  wsClients.push(ws);
  // console.log('wsClients.length: ', wsClients.length);
  ws.on('close', () => {
    const closedWS = wsClients.find((user) => user === ws);
    if (!closedWS) return;
    wsClients = wsClients.filter((user) => user !== closedWS);
    if (!wsClients.length) return;
  });

  ws.on('message', (msg) => {
    let jsonMsg;
    try {
      jsonMsg = JSON.parse(msg);
    } catch (e) {
      console.log('e: ', e);
      console.log('e.name: ', e.name);
    }

    if (!jsonMsg) return;

    switch (jsonMsg.request) {
      case 'create':
        let postIndex;
        if(jsonMsg.method === 'POST') {
          const id = uuid.v4();
          postList.push({
            id,
            timestamp: new Date().getTime(),
            coordinates: jsonMsg.coordinates,
            text: jsonMsg.text,
            status: {
              pinned: false,
              favorite: false,
            }
          });  
          postIndex = postList.findIndex(post => post.id === id);      
        }
        
        if(jsonMsg.method === 'GET') postIndex = postList.findIndex(post => post.id === jsonMsg.id); 
        // console.log('postList: ', postList);
        console.log('postIndex: ', postIndex); 

        if (postIndex >= 0) {
          console.log('post[postIndex]: ', postList[postIndex]);
          const response = {
            status: 'success',
            type: 'post',
            content: postList[postIndex],
          };

          [...wsServer.clients]
          .filter((client) => client.readyState === WS.OPEN)
          .forEach((client) => client.send(JSON.stringify(response)));
        }


      break;  

      case 'posts':
        // console.log('presetPostsArray: ', presetPostsArray);
        if (!postList.length) {
          console.log('empty postList');
          return;
        }
        let postsArrResponse = [];
        let lazyload = false;
        // console.log('postList.length: ', postList.length);
        // initial load
        if (postList.length <= 10 && !jsonMsg.lastPostID) {
          postsArrResponse = [...postList];
        }

        if (postList.length > 10 && !jsonMsg.lastPostID) {
          postsArrResponse = [...postList].slice(-10);
        }
        // lazy load      
        if (postList.length > 10 && jsonMsg.lastPostID) {
          // console.log('lastPostID: ', jsonMsg.lastPostID);
          const lastPostIndex = postList.findIndex((post) => post.id === jsonMsg.lastPostID);
          // console.log('lastPostIndex: ', lastPostIndex);
          // console.log('lastPostIndex_slice(-index): ', lastPostIndex - postList.length);
          if (lastPostIndex === 0) break;
          if (lastPostIndex > 0) {
          const startPostIndex = lastPostIndex - postList.length; 
          const endPostIndex = lastPostIndex - postList.length - 10;
          // console.log('startPostIndex: ', startPostIndex);
          // console.log('endPostIndex: ', endPostIndex);
          postsArrResponse = [...postList].slice(endPostIndex, startPostIndex).reverse();
          lazyload = true;
          }
        }

        const response = {
          status: 'success',
          type: 'postsArray',
          content: postsArrResponse,
          lazyload,
        };
        // console.log('postsArrResponse.length: ', postsArrResponse.length);
        // console.log('postsArrResponse: ', postsArrResponse);
        // console.log('lazyload: ', lazyload);
        ws.send(JSON.stringify(response));
      break;

        case 'pin':  
        // console.log('pin_postList_start: ', postList);
        const pinIndex = postList.findIndex((post) => post.id === jsonMsg.id);
        // console.log('pin_postList_pinIndex: ', pinIndex);
        if (pinIndex < 0) return;        
        const responsePinned = {
          status: 'success',
          type: 'pinned',
          oldPinned: {},
          newPinned: {},
        };
        const pinCurrentIndex = postList.findIndex((post) => post.status.pinned);
        if (pinCurrentIndex < 0) {
          postList[pinIndex].status.pinned = !postList[pinIndex].status.pinned; 
          responsePinned.newPinned.id = postList[pinIndex].id;  
          responsePinned.newPinned.status = postList[pinIndex].status.pinned;          
        }        
        if (pinCurrentIndex >=0 && pinIndex !== pinCurrentIndex) {
          postList[pinCurrentIndex].status.pinned = false;
          postList[pinIndex].status.pinned = true;
          responsePinned.oldPinned.id = postList[pinCurrentIndex].id;
          responsePinned.oldPinned.status = postList[pinCurrentIndex].status.pinned; 
          responsePinned.newPinned.id = postList[pinIndex].id;  
          responsePinned.newPinned.status = postList[pinIndex].status.pinned; 
        }         
        if (pinCurrentIndex >=0 && pinIndex === pinCurrentIndex) {
          postList[pinIndex].status.pinned = !postList[pinIndex].status.pinned; 
          responsePinned.newPinned.id = postList[pinIndex].id;  
          responsePinned.newPinned.status = postList[pinIndex].status.pinned;  
        }         
        // console.log('pin_postList_end: ', postList);
        // console.log('pin_responsePinned: ', responsePinned);

        [...wsServer.clients]
        .filter((client) => client.readyState === WS.OPEN)
        .forEach((client) => client.send(JSON.stringify(responsePinned)));
          break;

        case 'favorite': 
        const favoriteIndex = postList.findIndex((post) => post.id === jsonMsg.id);
        if (favoriteIndex < 0) return;
        postList[favoriteIndex].status.favorite = !postList[favoriteIndex].status.favorite;
        // console.log('favorite: ', postList[favoriteIndex]);
        // console.log('favorite_postList: ', postList);
        const responseFavorite = {
          status: 'success',
          type: 'favorite',
          favorite: {
            id: postList[favoriteIndex].id,
            status: postList[favoriteIndex].status.favorite,
          },
        };
        [...wsServer.clients]
        .filter((client) => client.readyState === WS.OPEN)
        .forEach((client) => client.send(JSON.stringify(responseFavorite)));
        // console.log('favorite_responseFavorite: ', responseFavorite);
          break;

      default:
        console.log('default case jsonMsg.type: ', jsonMsg.type);
        break;
    }
  });
});

server.listen(port, (err) => {
  if (err) {
    console.log('Error occured:', err);
    return;
  }
  console.log(`\nserver is listening on ${port}`);
});
