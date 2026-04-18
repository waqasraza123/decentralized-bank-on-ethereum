import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type AppErrorBoundaryProps = {
  title: string;
  message: string;
  actionLabel: string;
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App runtime boundary triggered.", error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          backgroundColor: "#f6f1e8",
          gap: 16
        }}
      >
        <Text
          style={{
            color: "#14212b",
            fontSize: 22,
            fontWeight: "700",
            textAlign: "center"
          }}
        >
          {this.props.title}
        </Text>
        <Text
          style={{
            color: "#475467",
            fontSize: 15,
            lineHeight: 22,
            textAlign: "center"
          }}
        >
          {this.props.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          style={{
            minWidth: 180,
            borderRadius: 999,
            backgroundColor: "#14212b",
            paddingHorizontal: 20,
            paddingVertical: 14
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 14,
              fontWeight: "600",
              textAlign: "center"
            }}
          >
            {this.props.actionLabel}
          </Text>
        </Pressable>
      </View>
    );
  }
}
