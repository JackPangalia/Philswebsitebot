import "./App.css";
import { Send } from "./Icons/Send";

function App() {
  return (
    <div className="bg-gray-50 w-full h-screen">
      <div className="absolute bottom-16 right-4">
        <div className="rounded-xl h-[660px] w-[390px] shadow-sm bg-white p-4">
          <div className = 'h-[91%]'></div>
          <div className = "shadow-md border-t-2 border-zinc-100 p-3 rounded-4xl flex justify-between">
            <input className = 'outline-none w-[85%]' placeholder="Ask a question..."/>
            <button><Send className = 'size-6 text-zinc-500 mt-1 mr-1 '/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
