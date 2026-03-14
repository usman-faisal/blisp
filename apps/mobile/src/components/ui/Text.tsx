import { Text as RNText, TextProps } from "react-native";

const StyledText = (props: TextProps) => {
    return (
        <RNText {...props} className={`font-text ${props.className || ""}`} />
    );
};

export default StyledText;