import { default as extend } from '../common/extend';
import Extend from 'flarum/common/extenders';
import UploadsUserPage from './components/UploadsUserPage';

export default [
  ...extend,

  new Extend.Routes() //
    .add('user.uploads', '/u/:username/uploads', UploadsUserPage),
];
