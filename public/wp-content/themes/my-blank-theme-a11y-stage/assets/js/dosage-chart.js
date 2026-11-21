(function(){
  var table=document.getElementById('pdh-table');
  var body=document.getElementById('pdh-body');
  var q=document.getElementById('pdh-q');
  var countEl=document.getElementById('pdh-count');
  var filterBtns=document.querySelectorAll('.pdh-filters button');
  var rows=Array.prototype.slice.call(body.querySelectorAll('tr'));
  var curFilter='all';
  var columnLabels=['Peptide','Vial size','Type','Protocol concentration','Protocol dose range','Frequency'];
  var naturalSort=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  var measurementColumns={1:true,3:true,4:true};

  function parseMeasurement(text,columnIndex){
    var values=[];
    var pattern=/(-?\d+(?:,\d{3})*(?:\.\d+)?)\s*(mcg|ug|\u00b5g|mg|g|iu)\b/gi;
    var match;
    while((match=pattern.exec(String(text||'')))!==null){
      var number=parseFloat(match[1].replace(/,/g,''));
      var unit=match[2].toLowerCase();
      var family=unit==='iu'?'iu':'mass';
      var multiplier=unit==='g'?1000000:(unit==='mg'?1000:1);
      values.push({family:family,value:number*multiplier});
    }
    if(!values.length)return {valid:false};

    var family=values[0].family;
    var comparable=values.filter(function(item){return item.family===family;});
    var primary=comparable[0].value;
    if(columnIndex===1&&comparable.length>1&&String(text).indexOf('+')!==-1){
      primary=comparable.reduce(function(total,item){return total+item.value;},0);
    }
    return {
      valid:true,
      family:family,
      primary:primary,
      secondary:comparable.length>1?comparable[1].value:primary
    };
  }

  rows.forEach(function(r,rowIndex){
    r._pdhSearch=(r.querySelector('.pdh-name').textContent||'').toLowerCase();
    r._pdhSort=Array.prototype.map.call(r.children,function(cell){return cell.textContent.trim().toLowerCase();});
    r._pdhOriginalIndex=rowIndex;
    Array.prototype.forEach.call(r.children,function(cell,index){
      cell.setAttribute('data-label',columnLabels[index]||'');
    });
    var nameCell=r.querySelector('.pdh-name');
    if(nameCell)nameCell.setAttribute('role','rowheader');
  });

  // Populate stat cards from the actual rendered rows (stays accurate as rows change)
  function setTxt(id,val){var el=document.getElementById(id);if(el)el.textContent=val;}
  (function(){
    var st={'single-peptide-dosages':0,'peptide-blend-dosages':0,'peptide-stack-dosages':0};
    rows.forEach(function(r){var c=r.getAttribute('data-cat');if(st[c]!=null)st[c]++;});
    setTxt('pdh-stat-total',rows.length);
    setTxt('pdh-stat-single',st['single-peptide-dosages']);
    setTxt('pdh-stat-blends',st['peptide-blend-dosages']);
    setTxt('pdh-stat-stacks',st['peptide-stack-dosages']);
  })();

  function update(){
    var term=(q.value||'').toLowerCase().trim();
    var shown=0;
    rows.forEach(function(r){
      var okF=(curFilter==='all'||r.getAttribute('data-cat')===curFilter);
      var okQ=(!term||r._pdhSearch.indexOf(term)>-1);
      r.hidden=!(okF&&okQ);
      if(!r.hidden)shown++;
    });
    var ex=body.querySelector('.pdh-empty-row');
    if(shown===0){
      if(!ex){var tr=document.createElement('tr');tr.className='pdh-empty-row';tr.innerHTML='<td class="pdh-empty" colspan="6">No peptides match your search.</td>';body.appendChild(tr);}
    }else if(ex){ex.remove();}
    countEl.textContent='Showing '+shown+' of '+rows.length+' peptides';
  }
  q.addEventListener('input',update);
  filterBtns.forEach(function(b){b.addEventListener('click',function(){
    filterBtns.forEach(function(x){x.classList.remove('active');x.setAttribute('aria-pressed','false');});
    b.classList.add('active');b.setAttribute('aria-pressed','true');curFilter=b.getAttribute('data-f');update();
  });});

  // Column sorting
  var ths=table.querySelectorAll('thead th');
  var sortButtons=table.querySelectorAll('.pdh-sort');
  var scrollRegion=table.closest('.pdh-scroll');
  var mobileSort=document.getElementById('pdh-sort-mobile');
  var mobileDirection=document.getElementById('pdh-sort-direction');
  var mobileDirectionIcon=mobileDirection?mobileDirection.querySelector('.pdh-sort-direction-icon'):null;
  var mobileDirectionText=mobileDirection?mobileDirection.querySelector('.screen-reader-text'):null;
  var mobileQuery=window.matchMedia('(max-width:680px)');
  var sortColumn=-1;
  var sortAscending=true;
  function applySort(idx,ascending){
    sortColumn=idx;
    sortAscending=ascending;
    ths.forEach(function(th){th.setAttribute('aria-sort','none');});
    ths[idx].setAttribute('aria-sort',sortAscending?'ascending':'descending');
    var visible=rows.slice();
    visible.sort(function(a,b){
      var x=a._pdhSort[idx];
      var y=b._pdhSort[idx];
      var comparison=0;
      if(measurementColumns[idx]){
        var xMeasurement=parseMeasurement(x,idx);
        var yMeasurement=parseMeasurement(y,idx);
        if(xMeasurement.valid!==yMeasurement.valid)return xMeasurement.valid?-1:1;
        if(xMeasurement.valid&&yMeasurement.valid){
          if(xMeasurement.family!==yMeasurement.family){
            return xMeasurement.family==='mass'?-1:1;
          }
          comparison=xMeasurement.primary-yMeasurement.primary;
          if(comparison===0)comparison=xMeasurement.secondary-yMeasurement.secondary;
        }
      }else{
        comparison=naturalSort.compare(x,y);
      }
      if(comparison===0)comparison=naturalSort.compare(a._pdhSort[0],b._pdhSort[0]);
      if(comparison===0)comparison=a._pdhOriginalIndex-b._pdhOriginalIndex;
      return sortAscending?comparison:-comparison;
    });
    visible.forEach(function(r){body.appendChild(r);});
    if(mobileSort)mobileSort.value=String(idx);
    if(mobileDirection){
      mobileDirection.setAttribute('aria-label',sortAscending?'Sort descending':'Sort ascending');
      if(mobileDirectionIcon)mobileDirectionIcon.textContent=sortAscending?'↑':'↓';
      if(mobileDirectionText)mobileDirectionText.textContent=sortAscending?'Ascending':'Descending';
    }
  }
  sortButtons.forEach(function(button){button.addEventListener('click',function(){
    var idx=parseInt(button.getAttribute('data-column'),10);
    applySort(idx,sortColumn===idx?!sortAscending:true);
  });});
  if(mobileSort)mobileSort.addEventListener('change',function(){applySort(parseInt(mobileSort.value,10),true);});
  if(mobileDirection)mobileDirection.addEventListener('click',function(){
    var idx=parseInt(mobileSort.value,10);
    applySort(idx,sortColumn===idx?!sortAscending:true);
  });

  function syncResponsiveChart(){
    var isMobile=mobileQuery.matches;
    if(scrollRegion){
      scrollRegion.tabIndex=isMobile?-1:0;
      scrollRegion.setAttribute('aria-label',isMobile?'Peptide dosage chart displayed as cards.':'Peptide dosage chart with sortable columns.');
    }
    sortButtons.forEach(function(button,index){
      if(isMobile){
        button.setAttribute('tabindex','-1');
        button.setAttribute('aria-hidden','true');
        if(ths[index])ths[index].setAttribute('aria-label',columnLabels[index]);
      }else{
        button.removeAttribute('tabindex');
        button.removeAttribute('aria-hidden');
        if(ths[index])ths[index].removeAttribute('aria-label');
      }
    });
  }
  syncResponsiveChart();
  if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',syncResponsiveChart);
  else if(mobileQuery.addListener)mobileQuery.addListener(syncResponsiveChart);

  update();
})();
