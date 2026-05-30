import "opentui-spinner/react";
import { useEffect, useState } from "react";
import { useTheme } from "../providers/theme";

const spinnerMessages = [
  "thinking",
  "analyzing",
  "verifying",
  "loading",
  "preparing",
  "checking",
  "processing",
  "fetching data",
  "updating",
  "compiling",
  "calculating",
  "rendering",
  "syncing",
  "initializing",
  "authenticating",
  "generating",
  "optimizing",
  "crunching numbers",
  "parsing tokens",
  "generating insights",
  "scanning databases",
  "structuring data",
  "synthesizing response",
  "spinning the gears",
  "doing some heavy lifting",
  "polishing the pixels",
  "waking up the servers",
  "assembling bits and bytes",
  "finishing up",
];

function getRandomMessage() {
  return spinnerMessages[Math.floor(Math.random() * spinnerMessages.length)];
}

export function Spinner({ message }: { message?: string }) {
  const { colors } = useTheme();
  const [targetMessage, setTargetMessage] = useState(
    message ?? getRandomMessage(),
  );
  const [displayMessage, setDisplayMessage] = useState("");

  // 1. Handle switching target messages
  useEffect(() => {
    if (message) {
      setTargetMessage(message);
      return;
    }

    setTargetMessage(getRandomMessage());
    const interval = setInterval(() => {
      setTargetMessage(getRandomMessage());
    }, 7000);

    return () => clearInterval(interval);
  }, [message]);

  // 2. Handle the typewriter effect safely
  useEffect(() => {
    // Reset the display message immediately when targetMessage changes
    setDisplayMessage("");
    if (!targetMessage) return;

    let index = 0;

    const interval = setInterval(() => {
      // Use the functional state update to safely append characters
      setDisplayMessage((prev) => {
        // If we've already typed the whole string, clear interval and return
        if (index >= targetMessage.length) {
          clearInterval(interval);
          return prev;
        }
        
        const nextChar = targetMessage[index];
        index += 1;
        return prev + nextChar;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [targetMessage]);

  return (
    <box
      flexDirection="row"
      gap={1}
      alignItems="center"
      justifyContent="center"
    >
      <text>{displayMessage}</text>
      <spinner name="dots" color={colors.primary} />
    </box>
  );
}