import React from 'react';
import ReactDOM from 'react-dom';
import { Icon, Button } from 'antd';
import deepEql from 'deep-eql';
import dragula from 'dragula';
import Editor from 'react-medium-editor';
import { setTemplateData, setCurrentData } from '../../../edit-module/actions';
import { getChildRect, getCurrentDom, getDataSourceValue } from '../utils';
import { isImg, deepCopy, mergeEditDataToDefault } from '../../../utils';
import webData from '../template.config';
import tempData from '../../../templates/template/element/template.config';
import EditButtton from './StateComponents/EditButtonView';
import BannerSlideFunc from './StateComponents/BannerSlideFunc';

const $ = window.$ || {};

class EditStateController extends React.PureComponent {
  static defaultProps = {
    className: 'edit-stage',
  };

  state = {
    data: null,
    iframe: null,
    editText: '',
    currentHoverRect: {},
    currentSelectRect: {},
  }

  scrollTop = 0;

  componentDidMount() {
    // 接收子级里传来的 dom 数据;
    // window.addEventListener('message', this.receiveDomData);
    window.receiveDomData = this.receiveDomData;
    // 重置框
    $(window).resize(this.reRect);
    // 拖动
    let newId;
    this.side = document.querySelector('.edit-side-drawer .drawer-content');
    this.stage = document.querySelector('.edit-stage .overlay');

    const t = dragula([this.side, this.stage], {
      copy: (el, source) => source === this.side,
      moves: (el, container, handle) => (
        handle.classList.contains('drag-hints') || handle.tagName.toLocaleLowerCase() === 'img'
      ),
      accepts: (el, source) => {
        if (source === this.stage) {
          const elKey = el.getAttribute('data-key');
          const data = this.state.data;
          const dArr = Object.keys(data).filter(key => key.split('_')[0] === elKey)
            .map(key => parseFloat(key.split('_')[1])).sort();
          newId = `${elKey}_${dArr[dArr.length - 1] + 1}`;
        }
        return source === this.stage;
      },
    });
    t.on('drag', () => {
      newId = '';
      this.isDrap = true;
      this.reRect();
      $(this.stage).addClass('drag');
    })
      .on('dragend', () => {
        $(this.stage).removeClass('drag');
      })
      .on('drop', (el) => {
        if (el.className === 'placeholder') {
          el.innerHTML = '';
          el.setAttribute('id', newId);
        }
      })
      .on('shadow', (e) => {
        // 挡掉上下拖动滚动跳动；
        this.dom.scrollTop = this.scrollTop;
        // 占位符
        if (e.className.indexOf('img-wrapper') >= 0) {
          e.className = 'placeholder';
          e.innerHTML = '放在此处';
        }
      })
      .on('out', (el, source) => {
        if (source === this.stage) {
          if (el.className === 'placeholder' || el.className === 'overlay-elem') {
            const children = Array.prototype.slice.call(source.children);
            const template = children.map(item => item.getAttribute('id')).filter(id => id);
            const { templateData } = this.props;
            if (el.className === 'placeholder') {
              el.remove();
            }
            templateData.data = {
              ...templateData.data,
              template,
            };
            const { dispatch } = this.props;
            dispatch(setTemplateData(templateData));
          }
        }
      })
      .on('cloned', (clone, original, type) => {
        if (type === 'mirror' && clone.className.indexOf('img-wrapper') === -1) {
          const key = clone.getAttribute('data-key');
          const keyName = key.replace(/[^a-z]/ig, '');
          const keyId = parseFloat(key.replace(/[a-z]/ig, ''));
          const item = webData[keyName].data
            .filter((c, i) => (c.uid === keyId || i === keyId))[0];
          clone.style.backgroundImage = `url(${item && item.src})`;
          clone.style.backgroundSize = 'cover';
          clone.style.backgroundPosition = 'center';
        }
      });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.mediaStateSelect !== this.props.mediaStateSelect) {
      this.reRect();
    }
    if (nextProps.currentEditData) {
      const dom = nextProps.currentEditData.dom;
      setTimeout(() => {
        // 避免使用多次样式，这里使用 setTimeout 等子级刷新
        this.setState({
          currentSelectRect: dom.getBoundingClientRect(),
        });
      });
    }
  }

  reRect = () => {
    this.currentData = null;
    this.mouseCurrentData = null;
    this.setState({
      currentHoverRect: {},
      currentSelectRect: {},
    }, () => {
      this.props.dispatch(setCurrentData());
    });
  }

  onOverlayScroll = (e) => {
    if (e.target === this.dom) {
      const iframeWindow = this.state.iframe;
      iframeWindow.scrollTo(0, e.target.scrollTop);
      this.scrollTop = e.target.scrollTop;
    }
    // this.reRect();
  }

  wrapperMove = (e) => {
    const dom = e.target;
    const { data, currentHoverRect } = this.state;
    let currentSelectRect = this.state.currentSelectRect;
    if (!this.isDrap && dom.getAttribute('data-key')) {
      const id = dom.getAttribute('id');
      const currentElemData = data[id];
      // 重置数据里的 rect，滚动条发生变化会随着变化。
      currentElemData.rect = currentElemData.item.getBoundingClientRect();
      // 获取子级带 data-id 的 rect; 由于有动画组件，所以时时获取
      const rectArray = getChildRect(currentElemData);
      if (this.currentData) {
        // dom 在 queueAnim 删除后将不再是当前 dom; 当前从新获取；
        const newCurrentData = rectArray.filter(item => (
          item.dataId === this.currentData.dataId
        ))[0];
        this.currentData = newCurrentData || this.currentData;
        if (this.currentData) {
          currentSelectRect = this.currentData.item.getBoundingClientRect();
          this.currentData.rect = currentSelectRect;
        }
      }
      const domRect = this.dom.getBoundingClientRect();
      const pos = {
        x: e.pageX - domRect.x,
        y: e.pageY - domRect.y,
      };
      this.mouseCurrentData = getCurrentDom(pos, rectArray) || currentElemData;
      if (!deepEql(this.mouseCurrentData.rect, currentHoverRect)) {
        this.setState({
          currentHoverRect: this.mouseCurrentData.rect,
          currentSelectRect,
        });
      }
    }
  }

  receiveDomData = (data, iframe) => {
    this.setState({
      data,
      iframe,
    });
  }
  wrapperLeave = () => {
    this.setState({
      currentHoverRect: {},
    });
  }

  closeEditText = () => {
    this.setState({
      openEditText: false,
    });
  }

  setTemplateConfigData = (text) => {
    const data = deepCopy(this.props.templateData);
    const ids = this.currentData.dataId.split('-');
    const t = getDataSourceValue(ids[1], data.data.config, [ids[0], 'dataSource']);
    t.children = text;
    this.props.dispatch(setTemplateData(data));

    setTimeout(() => {
      // 等子级刷新。
      this.setState({
        currentSelectRect: this.currentData.item.getBoundingClientRect(),
      });
    });
  }

  editTextHandleChange = (text) => {
    this.setState({
      editText: text,
      isInput: true,
    }, () => {
      // 修改 props 里的 dataSource 数据
      this.setTemplateConfigData(text);
    });
  }

  getDataSourceChildren = (_t, id) => {
    const ids = id.split('&');
    let t = _t;
    ids.forEach((key) => {
      const nameKey = key.split('=');
      if (nameKey.length > 1 && nameKey[0] === 'array_name') {
        t.forEach((item) => {
          if (item.name === nameKey[1]) {
            t = item;
          }
        });
      } else {
        t = t[key];
      }
    });
    return t;
  }

  getCatcherDom = (rect, css) => {
    if (rect.width) {
      let editText;
      if (css === 'select') {
        const currentConfigDataSource = mergeEditDataToDefault(
          this.props.templateData.data.config[this.currentIdArray[0]], tempData[this.editId]);
        editText = this.getDataSourceChildren(currentConfigDataSource,
          this.editChildId).children;
      }
      return (
        <div className={css}
          style={{
            width: rect.width,
            height: rect.height,
            left: rect.x,
            top: rect.y + this.scrollTop,
          }}
        >
          {css === 'select' && <EditButtton
            setTemplateConfigData={this.setTemplateConfigData}
            closeEditText={this.closeEditText}
            openEditTextFunc={this.editTextFunc}
            editButtonArray={this.state.editButton}
            currentData={this.currentData}
            scrollTop={this.scrollTop}
            onParentChange={this.onEditSelectChange}
            editText={editText}
          />}
          {css === 'select' && this.state.openEditText ? (
            <div className="edit-text-wrapper">
              <Editor
                text={this.state.editText}
                onChange={this.editTextHandleChange}
                options={{ toolbar: false }}
                ref={(c) => {
                  const d = ReactDOM.findDOMNode(c);
                  if (!d) {
                    return;
                  }
                  if (!this.state.isInput) {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(d);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                }}
              />
              <style
                dangerouslySetInnerHTML={{
                  __html: `.edit-text-wrapper{${
                    document.defaultView.getComputedStyle(this.currentData.item).cssText}}`,
                }}
              />
            </div>) : null}
        </div>
      );
    }
  }

  selectSteState = (currentSelectRect, editData, dom, id) => {
    this.setState({
      currentHoverRect: currentSelectRect,
      currentSelectRect,
      editButton: editData && editData.split(','), // 文字与图片按钮配置
      openEditText: false,
      isInput: false,
    }, () => {
      this.props.dispatch(setCurrentData(
        {
          dom,
          id,
          reRect: this.reRect,
        }
      ));
    });
  }

  onClick = (e) => {
    const dom = e.target;
    if (!this.isDrap && dom.getAttribute('data-key')) {
      this.currentIdArray = this.mouseCurrentData.dataId.split('-');
      this.editId = this.currentIdArray[0].split('_')[0];
      this.editChildId = this.currentIdArray[1];
      this.currentData = this.mouseCurrentData;
      const currentDom = this.currentData.item;
      const editData = currentDom.getAttribute('data-edit');

      this.selectSteState(this.state.currentHoverRect,
        editData, currentDom, this.mouseCurrentData.dataId);
    }
    this.isDrap = false;
  }

  onEditSelectChange = (v) => {
    this.currentIdArray = v.dataId.split('-');
    this.editId = this.currentIdArray[0].split('_')[0];
    this.editChildId = this.currentIdArray[1];
    this.currentData = v;
    const currentDom = v.item;
    const currentDomRect = currentDom.getBoundingClientRect();
    this.currentData.rect.y = currentDomRect.y;
    const editData = currentDom.getAttribute('data-edit');
    this.selectSteState(this.currentData.rect, editData, currentDom, v.dataId);
  }

  editTextFunc = () => {
    const currentConfigDataSource = mergeEditDataToDefault(
      this.props.templateData.data.config[this.currentIdArray[0]], tempData[this.editId]);
    let editText = this.getDataSourceChildren(currentConfigDataSource, this.editChildId).children;
    editText = editText.match(isImg) ? '请输入...' : editText;
    this.setState({
      editText,
      openEditText: true,
      isInput: false,
    });
  }

  onDoubleClick = (e) => {
    const dom = e.target;
    if (dom.getAttribute('data-key')) {
      this.currentData = this.mouseCurrentData;
      const editData = this.currentData.item.getAttribute('data-edit');
      if (editData && editData.indexOf('text') >= 0) {
        this.editTextFunc();
      }
    }
  }

  onFuncClick = (type, key) => {
    this.reRect();
    const { templateData } = this.props;
    const template = templateData.data.template;
    const current = template.indexOf(key);
    switch (type) {
      case 'up':
        template[current] = template.splice(current - 1, 1, template[current])[0];
        break;
      case 'down':
        template[current] = template.splice(current + 1, 1, template[current])[0];
        break;
      default:
        template.splice(current, 1);
        break;
    }
    this.props.dispatch(setTemplateData(templateData));
  }

  getFuncIconChild = (i, dataArray, key) => {
    return ['up', 'down', 'delete'].map((type) => {
      let disabled = false;
      switch (type) {
        case 'up':
          disabled = !i;
          break;
        case 'down':
          disabled = i === dataArray.length - 1;
          break;
        default:
          disabled = dataArray.length === 1;
          break;
      }
      return (
        <Button
          type="primary"
          disabled={disabled}
          key={type}
          onClick={(e) => { this.onFuncClick(type, key, e); }}
        >
          <Icon type={type} />
        </Button>
      );
    });
  }

  getFuncCompChild = (comp, dataId) => {
    const compArray = comp.split('=');
    const name = compArray[0];
    const data = JSON.parse(compArray[1] || '{}');
    switch (name) {
      case 'banner-switch':
        return (
          <BannerSlideFunc
            {...this.props}
            data={data}
            dataId={dataId}
            iframe={this.state.iframe}
            reRect={this.reRect}
          />
        );
      default:
        return null;
    }
  }

  render() {
    const { className, mediaStateSelect, templateData } = this.props;
    const { data, currentHoverRect, currentSelectRect, iframe, openEditText } = this.state;

    const dataArray = data ? Object.keys(data) : [];
    const overlayChild = dataArray.map((key, i) => {
      const item = data[key];
      const itemRect = item.rect;
      return (
        <div
          key={key}
          id={key}
          data-key={key.split('_')[0]}
          style={{ height: itemRect.height }}
          onMouseMove={this.wrapperMove}
          onMouseEnter={this.wrapperMove}
          onClick={this.onClick}
          onDoubleClick={this.onDoubleClick}
          className="overlay-elem"
        >
          <div className="drag-hints"><Icon type="bars" /> 拖拽此处加中键滚动或点击右侧按钮可更换位置</div>
          <div className="func-wrapper">
            {this.getFuncIconChild(i, dataArray, key)}
          </div>
          {item.comp && this.getFuncCompChild(item.comp, key)}
        </div>);
    });
    const overlayHeight = iframe && iframe.document.getElementById('react-content').offsetHeight;
    return (
      <div
        className={`${className}${mediaStateSelect === 'Mobile' ? ' mobile' : ''}`}
        onScroll={this.onOverlayScroll}
        onMouseLeave={this.wrapperLeave}
        ref={(c) => { this.dom = c; }}
      >
        <div className="overlay" style={{ height: overlayHeight }}>
          {overlayChild}
        </div>
        <div className="mouse-catcher" >
          {!deepEql(currentHoverRect, currentSelectRect) && !openEditText
            && this.getCatcherDom(currentHoverRect, 'hover')}
          {this.getCatcherDom(currentSelectRect, 'select')}
        </div>
      </div>
    );
  }
}
export default EditStateController;