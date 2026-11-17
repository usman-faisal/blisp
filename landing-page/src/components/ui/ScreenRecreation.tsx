import React from 'react';
import { AppScreenshotId } from '../../data/screenshots';
import {
  DiscoveryReportScreenRecreation,
  FocusScreenRecreation,
  IncubatorScreenRecreation,
  JoinProjectScreenRecreation,
  MyProjectsScreenRecreation,
  NotificationsScreenRecreation,
  ProjectOverviewScreenRecreation,
  RoadmapScreenRecreation,
} from '../screens/CoreScreens';
import {
  CaptureIdeaScreenRecreation,
  ConnectGitHubScreenRecreation,
  InviteCollaborateScreenRecreation,
  SignUpWelcomeScreenRecreation,
  SmartNudgesScreenRecreation,
} from '../screens/MissingScreens';

export interface ScreenRecreationProps {
  name: AppScreenshotId;
}

export const ScreenRecreation: React.FC<ScreenRecreationProps> = ({ name }) => {
  switch (name) {
    case '01-focus':
      return <FocusScreenRecreation />;
    case '02-incubator':
      return <IncubatorScreenRecreation />;
    case '03-capture-idea':
      return <CaptureIdeaScreenRecreation />;
    case '04-my-projects':
      return <MyProjectsScreenRecreation />;
    case '06-notifications':
      return <NotificationsScreenRecreation />;
    case '07-roadmap-progress':
      return <RoadmapScreenRecreation />;
    case '08-discovery-report':
      return <DiscoveryReportScreenRecreation />;
    case '09-project-overview':
      return <ProjectOverviewScreenRecreation />;
    case '10-join-project':
      return <JoinProjectScreenRecreation />;
    case '11-sign-up-google':
      return <SignUpWelcomeScreenRecreation />;
    case '12-invite-collaborate':
      return <InviteCollaborateScreenRecreation />;
    case '13-connect-github':
      return <ConnectGitHubScreenRecreation />;
    case '14-smart-nudges':
      return <SmartNudgesScreenRecreation />;
    case '05-profile':
    default:
      return <FocusScreenRecreation />;
  }
};
