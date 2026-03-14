import { Text as RNText, TextProps } from "react-native";

const Heading = (props: TextProps) => {
    return (
        <RNText {...props} className={`font-heading ${props.className || ""}`} />
    );
};

export default Heading;