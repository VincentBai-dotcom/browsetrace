import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/popup/components/ui/card";
import { Switch } from "@/popup/components/ui/switch";
import { Badge } from "@/popup/components/ui/badge";
import { Activity, Pause } from "lucide-react";

export default function App() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        if (!chrome?.storage?.local) {
          throw new Error("Chrome storage API not available");
        }
        const { paused = false } = await chrome.storage.local.get("paused");
        setPaused(paused);
      } catch (error) {
        console.error("Failed to initialize popup:", error);
        setPaused(false);
      }
    }
    init();
  }, []);

  const handleToggle = async () => {
    try {
      if (!chrome?.storage?.local) {
        throw new Error("Chrome storage API not available");
      }
      const next = !paused;
      await chrome.storage.local.set({ paused: next });
      setPaused(next);
    } catch (error) {
      console.error("Failed to toggle paused state:", error);
    }
  };

  return (
    <div className="w-[500px] min-h-[350px] flex items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader className="space-y-4 pb-8">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-4 text-4xl">
              {paused ? (
                <Pause className="h-10 w-10" />
              ) : (
                <Activity className="h-10 w-10" />
              )}
              BrowseTrace
            </CardTitle>
            <Badge
              variant={paused ? "secondary" : "default"}
              className="text-xl px-4 py-2"
            >
              {paused ? "Paused" : "Active"}
            </Badge>
          </div>
          <CardDescription className="text-xl">
            Track your browsing activity and interactions
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="flex items-center justify-between gap-8">
            <div className="space-y-2 flex-1">
              <label
                htmlFor="capture-toggle"
                className="text-xl font-medium block"
              >
                Capture Events
              </label>
              <p className="text-lg text-muted-foreground">
                {paused
                  ? "Click to resume capturing"
                  : "Click to pause capturing"}
              </p>
            </div>
            <div className="flex items-center gap-8">
              <span className="text-xl font-medium">
                {paused ? "Start" : "Pause"}
              </span>
              <Switch
                id="capture-toggle"
                checked={!paused}
                onCheckedChange={() => handleToggle()}
                className="scale-[2] mr-4"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
