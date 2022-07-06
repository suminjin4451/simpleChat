import "./App.css";
import * as StompJs from "@stomp/stompjs";
// import * as SockJS from "sockjs-client";
import { useEffect, useRef, useState } from "react";
import * as axios from "axios";

var ROOM_SEQ = 0;

const App = () => {
  const client = useRef({});
  const [chatMessages, setChatMessages] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [ID, setID] = useState("");
  const [message, setMessage] = useState("");
  const [roomName, setroomName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(0);

  useEffect(() => {
    connect();

    axios
      .get("http://localhost:8080/roomlist")
      .then((res) => {
        console.log(res.data);
        setRoomList(res.data);
      })
      .catch((e) => console.log(e));
    return () => {
      disConnect();
    };
    //eslint-disable-next-line
  }, []);

  const publish = (message) => {
    if (!client.current.connected) {
      return;
    }

    client.current.publish({
      destination: `/pub/chat/message`,
      body: JSON.stringify({
        roomId: ROOM_SEQ,
        message: message,
        writer: ID,
      }),
    });

    setMessage("");
  };

  const exit = () => {
    setIsLoggedIn(0);
    console.log(ROOM_SEQ);
    client.current.publish({
      destination: `/pub/chat/exit`,
      body: JSON.stringify({
        roomId: ROOM_SEQ,
        writer: ID,
        message: null,
      }),
    });
    ROOM_SEQ = 0;
  };

  const connect = () => {
    if (client.current.connect) {
      return;
    }
    client.current = new StompJs.Client({
      brokerURL: "ws://localhost:8080/stomp/chat", // 웹소켓 서버로 직접 접속
      // webSocketFactory: () => new SockJS("/ws-stomp"), // proxy를 통한 접속
      connectHeaders: {
        "auth-token": "spring-chat-auth-token",
      },
      debug: function (str) {
        console.log(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        client.current.subscribe(
          `/sub/chat/roomlist`,
          ({ body }) => {
            console.log(body);
            setRoomList((_roomList) => [..._roomList, JSON.parse(body)]);
          },
          { id: "room" }
        );
      },
      onStompError: (frame) => {
        console.error(frame);
      },
    });
    client.current.activate();
  };

  const disConnect = () => {
    if (client.current.connected) client.current.deactivate();
  };

  const loginProcess = (id, roomId) => {
    setIsLoggedIn(1);
    setID(id);
    client.current.unsubscribe(`/sub/chat/roomlist`);
    if (roomId === 0) {
      client.current.subscribe(`/sub/chat/roomlist`, ({ body }) => {
        var temp = JSON.parse(body);
        ROOM_SEQ = temp.roomId;
        console.log("ROOM IS " + ROOM_SEQ);
        client.current.unsubscribe(`/sub/chat/roomlist`);
        client.current.subscribe(`/sub/chat/room/${ROOM_SEQ}`, ({ body }) => {
          console.log(roomList);
          setChatMessages((_chatMessages) => [
            ..._chatMessages,
            JSON.parse(body),
          ]);
        });
        client.current.publish({
          destination: `/pub/chat/enter`,
          body: JSON.stringify({
            message: null,
            roomId: ROOM_SEQ,
            writer: ID,
          }),
        });
      });
      client.current.publish({
        destination: `/pub/chat/roomlist`,
        body: JSON.stringify({
          roomName: roomName,
          players: 0,
        }),
      });
      (() => {
        window.addEventListener("beforeunload", exit);
      })();
    } else {
      ROOM_SEQ = roomId;

      client.current.subscribe(`/sub/chat/room/${ROOM_SEQ}`, ({ body }) => {
        console.log(roomList);
        setChatMessages((_chatMessages) => [
          ..._chatMessages,
          JSON.parse(body),
        ]);
      });
      client.current.publish({
        destination: `/pub/chat/enter`,
        body: JSON.stringify({
          message: null,
          roomId: ROOM_SEQ,
          writer: ID,
        }),
      });
      (() => {
        window.addEventListener("beforeunload", exit);
      })();
    }
  };

  if (isLoggedIn === 1) {
    return (
      <div>
        {chatMessages && chatMessages.length > 0 && (
          <ul>
            {chatMessages.map((_chatMessage, index) => (
              <li key={index}>
                {_chatMessage.writer} : {_chatMessage.message}
              </li>
            ))}
          </ul>
        )}
        <div>
          <input
            type={"text"}
            placeholder={"message"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.which === 13 && publish(message)}
          />
          <button onClick={() => publish(message)}>send</button>
          <button onClick={() => exit()}>exit</button>
        </div>
      </div>
    );
  } else {
    return (
      <div>
        <p>이름을 입력해주세요</p>
        <input
          type={"text"}
          placeholder={"type your ID Here"}
          value={ID}
          onChange={(e) => setID(e.target.value)}
        ></input>
        <ul></ul>
        <input
          type={"text"}
          placeholder={"Roomname Here!"}
          value={roomName}
          onChange={(e) => setroomName(e.target.value)}
        ></input>

        <button onClick={() => loginProcess(ID, 0)}>Login</button>
        <p>RoomList</p>
        {roomList && roomList.length > 0 && (
          <ul>
            {roomList.map((_roomList, index) => (
              <li>
                <button
                  key={index}
                  onClick={() => loginProcess(ID, _roomList.roomId)}
                >
                  {_roomList.roomName} / players : {_roomList.players}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
};

export default App;
